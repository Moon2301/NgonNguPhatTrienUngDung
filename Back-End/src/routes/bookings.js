import express from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { col, nextId } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { parseSeats, uniqueSeats } from '../utils/seats.js';
import { getSeatStatesForShowtime, getSeatHoldMs } from '../services/showtimeSeatmap.js';
import { areAdjacent, leavesLoneSeat } from '../utils/bookingValidation.js';

const router = express.Router();

router.get(
    '/showtimes/:id/seatmap',
    asyncHandler(async (req, res) => {
        const showtimeId = Number(req.params.id);
        const showtime = await col('showtimes').findOne({ id: showtimeId });
        if (!showtime) return res.status(404).json({ error: 'Không tìm thấy suất chiếu.' });

        const [movie, room] = await Promise.all([
            showtime.movie_id != null ? col('movies').findOne({ id: showtime.movie_id }, { projection: { title: 1 } }) : null,
            showtime.room_id != null ? col('rooms').findOne({ id: showtime.room_id }, { projection: { name: 1, total_rows: 1, total_cols: 1 } }) : null,
        ]);

        const { bookedSeats, heldSeats, occupiedSeats, myBookedSeats } = await getSeatStatesForShowtime(
            showtimeId,
            req.session?.user?.id
        );
        const products = await col('products')
            .find({ $or: [{ active: true }, { active: { $exists: false } }] }, { projection: { _id: 0 } })
            .sort({ id: -1 })
            .toArray();

        res.json({
            showtime: {
                ...showtime,
                movieTitle: movie?.title || null,
                roomName: room?.name || null,
            },
            rows: room?.total_rows || 10,
            cols: room?.total_cols || 10,
            products,
            occupiedSeats,
            bookedSeats,
            heldSeats,
            myBookedSeats,
            holdMinutes: Math.round(getSeatHoldMs() / 60000),
        });

    })
);

router.post(
    '/confirm',
    asyncHandler(async (req, res) => {
        const schema = z.object({
            showtimeId: z.coerce.number(),
            seats: z.array(z.string()),
            seatSocketId: z.string().optional().nullable(),
            promoCode: z.string().optional().nullable(),
            customerName: z.string().min(1).max(255),
            customerEmail: z.string().email().max(255),
            customerPhone: z.string().optional().nullable(),
            products: z
                .array(
                    z.object({
                        id: z.coerce.number(),
                        qty: z.coerce.number().int().min(0),
                    })
                )
                .optional(),
            paymentMethod: z.enum(['VNPAY', 'CASH']),
            returnUrl: z.string().optional().nullable(),
        });

        const input = schema.parse(req.body);
        const showtimeId = input.showtimeId;
        const userId = req.session?.user?.id;

        if (!userId) return res.status(401).json({ error: 'Bạn cần đăng nhập để đặt vé.' });

        const showtime = await col('showtimes').findOne({ id: showtimeId });
        if (!showtime) return res.status(404).json({ error: 'Suất chiếu không tồn tại.' });

        // TIME CHECKS
        const now = new Date();
        const startTime = new Date(showtime.start_time);
        const fifteenMinsBefore = new Date(startTime.getTime() - 15 * 60000);

        if (now > startTime) return res.status(400).json({ error: 'Suất chiếu đã bắt đầu hoặc đã kết thúc.' });
        if (now > fifteenMinsBefore) return res.status(400).json({ error: 'Đã quá thời hạn đặt vé trực tuyến (15 phút trước giờ chiếu).' });

        // ANTI-SPAM (Max 5 bookings per day)
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60000);
        const dailyCount = await col('bookings').countDocuments({ user_id: userId, booking_time: { $gt: dayAgo } });
        if (dailyCount >= 5) return res.status(429).json({ error: 'Bạn đã đạt giới hạn đặt vé trong ngày (tối đa 5 lần).' });

        // SEAT VALIDATIONS
        const room = await col('rooms').findOne({ id: showtime.room_id });
        if (!room) return res.status(500).json({ error: 'Dữ liệu phòng chiếu bị lỗi.' });

        if (!areAdjacent(input.seats)) {
            return res.status(400).json({ error: 'Các ghế được chọn phải nằm cạnh nhau trong cùng một hàng.' });
        }

        const { occupiedSeats } = await getSeatStatesForShowtime(showtimeId);
        const conflict = input.seats.some((s) => occupiedSeats.includes(s));
        if (conflict) return res.status(409).json({ error: 'Một số ghế đã bị chọn bởi người khác.' });

        // LONE SEAT CHECK (Check each row in the selection)
        const rowsInSelection = [...new Set(input.seats.map(s => s.charAt(0)))];
        for (const rId of rowsInSelection) {
            const selectedColsInRow = input.seats
                .filter(s => s.startsWith(rId))
                .map(s => parseInt(s.substring(1)));
            const rowOccupiedCols = occupiedSeats
                .filter(s => s.startsWith(rId))
                .map(s => parseInt(s.substring(1)));

            if (leavesLoneSeat(rId, selectedColsInRow, rowOccupiedCols, room.total_cols || 10)) {
                return res.status(400).json({ error: `Không được để ghế trống đơn lẻ ở hàng ${rId}.` });
            }
        }


        const status = input.paymentMethod === 'VNPAY' ? 'PENDING' : 'SUCCESS';
        const seatAmount = input.seats.length * Number(showtime.price || 0);

        let productAmount = 0;
        const productSnapshots = [];
        if (input.products && input.products.length > 0) {
            const pIds = input.products.map((p) => p.id);
            const dbProducts = await col('products').find({ id: { $in: pIds } }).toArray();
            const pMap = new Map(dbProducts.map((p) => [p.id, p]));

            for (const pInput of input.products) {
                const dbP = pMap.get(pInput.id);
                if (dbP && pInput.qty > 0) {
                    const price = Number(dbP.price || 0);
                    productAmount += price * pInput.qty;
                    productSnapshots.push({
                        id: dbP.id,
                        name: dbP.name,
                        price: price,
                        qty: pInput.qty,
                    });
                }
            }
        }

        let promoDiscount = 0;
        let appliedPromo = null;
        if (input.promoCode) {
            const promo = await col('promotions').findOne({ code: input.promoCode, active: true });
            if (promo) {
                if (promo.end_date && new Date(promo.end_date) < now) {
                    // ignore
                } else if (promo.min_order_value && (seatAmount + productAmount) < promo.min_order_value) {
                    // ignore
                } else {
                    promoDiscount = Number(promo.discount_value || 0);
                    appliedPromo = promo.code;
                }
            }
        }

        const totalAmount = Math.max(0, seatAmount + productAmount - promoDiscount);
        const bookingId = await nextId('bookings');

        await col('bookings').insertOne({
            id: bookingId,
            user_id: userId,
            showtime_id: showtimeId,
            customer_name: input.customerName,
            customer_email: input.customerEmail,
            customer_phone: input.customerPhone,
            seat_numbers: input.seats.join(','),
            total_amount: totalAmount,
            booking_time: new Date(),
            status: status,
            payment_method: input.paymentMethod,
            promo_code: appliedPromo,
            promo_discount: promoDiscount,
            products: productSnapshots,
        });

        if (input.paymentMethod === 'VNPAY') {
            return res.json({
                bookingId,
                paymentUrl: `https://vnpay-mock.example.com/pay?id=${bookingId}&amount=${totalAmount}&returnUrl=${encodeURIComponent(input.returnUrl || '')}`,
            });
        }

        res.json({ bookingId, status });
    })
);

router.get(
    '/me',
    requireAuth,
    asyncHandler(async (req, res) => {
        const userId = req.session.user.id;
        const bookings = await col('bookings')
            .find({ user_id: userId, status: 'SUCCESS' })
            .sort({ booking_time: -1 })
            .toArray();

        const stIds = [...new Set(bookings.map((b) => b.showtime_id))];
        const showtimes = await col('showtimes').find({ id: { $in: stIds } }).toArray();
        const stMap = new Map(showtimes.map((s) => [s.id, s]));

        const mvIds = [...new Set(showtimes.map((s) => s.movie_id))];
        const movies = await col('movies').find({ id: { $in: mvIds } }, { projection: { id: 1, title: 1, poster_url: 1 } }).toArray();
        const mvMap = new Map(movies.map((m) => [m.id, m]));

        const rmIds = [...new Set(showtimes.map((s) => s.room_id))];
        const rooms = await col('rooms').find({ id: { $in: rmIds } }, { projection: { id: 1, name: 1 } }).toArray();
        const rmMap = new Map(rooms.map((r) => [r.id, r]));

        const result = bookings.map((b) => {
            const st = stMap.get(b.showtime_id);
            const mv = st ? mvMap.get(st.movie_id) : null;
            const rm = st ? rmMap.get(st.room_id) : null;
            return {
                ...b,
                movieTitle: mv?.title || null,
                posterUrl: mv?.poster_url || null,
                roomName: rm?.name || null,
                start_time: st?.start_time || null,
            };
        });

        res.json({ bookings: result });
    })
);

router.post(
    '/apply-promo',
    asyncHandler(async (req, res) => {
        const { code, amount } = req.body;
        if (!code) return res.status(400).json({ error: 'Mã không hợp lệ' });

        const promo = await col('promotions').findOne({ code, active: true });
        if (!promo) return res.status(404).json({ error: 'Mã không tồn tại hoặc đã hết hạn.' });

        const now = new Date();
        if (promo.end_date && new Date(promo.end_date) < now) {
            return res.status(400).json({ error: 'Mã đã hết hạn.' });
        }
        if (promo.min_order_value && amount < promo.min_order_value) {
            return res.status(400).json({ error: `Đơn hàng tối thiểu ${promo.min_order_value.toLocaleString()}đ để dùng mã này.` });
        }

        res.json({
            code: promo.code,
            discountValue: promo.discount_value,
        });
    })
);

export default router;
