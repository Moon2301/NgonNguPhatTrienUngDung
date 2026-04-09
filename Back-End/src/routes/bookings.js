import express from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { col, nextId } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { parseSeats, uniqueSeats } from '../utils/seats.js';
import { getSeatStatesForShowtime, getSeatHoldMs } from '../services/showtimeSeatmap.js';
import { areAdjacent, leavesLoneSeat } from '../utils/bookingValidation.js';
import { sendTicketEmail } from '../services/emailService.js';

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
            payment_status: status,
            promo_code: appliedPromo,
            promo_discount: promoDiscount,
            products: productSnapshots,
        });

        if (input.paymentMethod === 'VNPAY') {
            const r = await fetch(`${process.env.INTERNAL_API_BASE || `http://localhost:${process.env.PORT || 4000}`}/api/payments/vnpay/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookingId,
                    amount: totalAmount,
                    orderInfo: `Thanh toán booking #${bookingId}`,
                    returnUrl: input.returnUrl,
                }),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) return res.status(r.status).json({ error: d.error || 'Không tạo được URL thanh toán.' });
            return res.status(201).json({ bookingId, paymentUrl: d.url });
        }

        // For Cash/Balance, if success - send email immediately (async)
        if (status === 'SUCCESS') {
            const [movie, room] = await Promise.all([
                col('movies').findOne({ id: showtime.movie_id }),
                col('rooms').findOne({ id: showtime.room_id })
            ]);
            const bookingForEmail = await col('bookings').findOne({ id: bookingId });
            if (movie && room && bookingForEmail) {
                sendTicketEmail(bookingForEmail, movie, showtime, room).catch(err => {
                    console.error('[EMAIL] Failed to send initial ticket email:', err);
                });
            }
        }

        res.json({ bookingId, status });
    })
);

router.get(
    '/me',
    requireAuth,
    asyncHandler(async (req, res) => {
        const userId = req.session.user.id;
        const now = new Date();

        // Fetch all non-failed, non-transferred bookings
        const bookings = await col('bookings')
            .find({ user_id: userId, status: { $nin: ['FAILED', 'CANCELLED', 'TRANSFERRED'] } })
            .sort({ booking_time: -1 })
            .toArray();

        // Batch fetch showtimes
        const stIds = [...new Set(bookings.map((b) => b.showtime_id))];
        const showtimes = await col('showtimes').find({ id: { $in: stIds } }).toArray();
        const stMap = new Map(showtimes.map((s) => [s.id, s]));

        // Batch fetch movies & rooms
        const mvIds = [...new Set(showtimes.map((s) => s.movie_id))];
        const movies = await col('movies').find({ id: { $in: mvIds } }).toArray();
        const mvMap = new Map(movies.map((m) => [m.id, m]));

        const rmIds = [...new Set(showtimes.map((s) => s.room_id))];
        const rooms = await col('rooms').find({ id: { $in: rmIds } }).toArray();
        const rmMap = new Map(rooms.map((r) => [r.id, r]));

        const result = bookings.map((b) => {
            const st = stMap.get(b.showtime_id);
            const mv = st ? mvMap.get(st.movie_id) : null;
            const rm = st ? rmMap.get(st.room_id) : null;

            // Calculate Dynamic Status
            let ticketStatus = 'PAST';
            if (st && st.start_time) {
                const startTime = new Date(st.start_time);
                // End time = start + duration (default 120m)
                const endTime = new Date(startTime.getTime() + (mv?.duration || 120) * 60000);

                if (now < startTime) {
                    ticketStatus = 'UPCOMING';
                } else if (now >= startTime && now <= endTime) {
                    ticketStatus = 'LIVE';
                }
            }

            return {
                ...b,
                movieTitle: mv?.title || 'Phim không tên',
                posterUrl: mv?.poster_url || null,
                duration: mv?.duration || 120,
                roomName: rm?.name || 'Phòng chiếu',
                start_time: st?.start_time || null,
                originalPrice: Number(st?.price || 0),
                ticketStatus: ticketStatus, // New field for UI tabs/badges
            };
        });

        // Enrichment: Mark which seats are already listed for sale
        const finalResults = await Promise.all(result.map(async (b) => {
            const listed = await col('ticket_passes').find({ 
                booking_id: b.id, 
                status: 'AVAILABLE' 
            }).toArray();
            return {
                ...b,
                listedSeats: listed.map(l => l.seat_number)
            };
        }));

        res.json({ bookings: finalResults });
    })
);

router.get(
    '/public/:id',
    asyncHandler(async (req, res) => {
        const bookingId = Number(req.params.id);
        const booking = await col('bookings').findOne({ id: bookingId });
        if (!booking) return res.status(404).json({ error: 'Vé không tồn tại.' });

        const st = await col('showtimes').findOne({ id: booking.showtime_id });
        const mv = st ? await col('movies').findOne({ id: st.movie_id }) : null;
        const rm = st ? await col('rooms').findOne({ id: st.room_id }) : null;

        res.json({
            id: booking.id,
            movieTitle: mv?.title || 'Phim không tên',
            posterUrl: mv?.poster_url || null,
            duration: mv?.duration || 120,
            roomName: rm?.name || 'Phòng chiếu',
            start_time: st?.start_time || null,
            seat_numbers: booking.seat_numbers,
            customer_name: booking.customer_name,
            total_amount: booking.total_amount,
            status: booking.status,
            booking_time: booking.booking_time
        });
    })
);

router.post(
    '/:id/resend-email',
    requireAuth,
    asyncHandler(async (req, res) => {
        const userId = req.session.user.id;
        const bookingId = Number(req.params.id);
        const booking = await col('bookings').findOne({ id: bookingId });

        if (!booking) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });
        if (booking.user_id !== userId) return res.status(403).json({ error: 'Bạn không có quyền thực hiện hành động này.' });

        // Real email sending
        const showtime = await col('showtimes').findOne({ id: booking.showtime_id });
        if (!showtime) return res.status(404).json({ error: 'Không tìm thấy thông tin suất chiếu.' });

        const [movie, room] = await Promise.all([
            col('movies').findOne({ id: showtime.movie_id }),
            col('rooms').findOne({ id: showtime.room_id })
        ]);

        if (!movie || !room) return res.status(500).json({ error: 'Dữ liệu phim hoặc phòng chiếu bị thiếu.' });

        try {
            await sendTicketEmail(booking, movie, showtime, room);
            res.json({ message: 'Đã gửi lại vé vào email ' + booking.customer_email + ' thành công!' });
        } catch (error) {
            res.status(500).json({ error: 'Gửi email thất bại: ' + error.message });
        }
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
