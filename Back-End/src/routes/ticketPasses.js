import express from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { col, nextId } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

// GET /api/ticket-passes - List available passes
router.get(
    '/',
    asyncHandler(async (req, res) => {
        const userId = req.session?.user?.id;
        const query = { status: 'AVAILABLE' };
        
        // Exclude my own passes
        if (userId) {
            query.seller_id = { $ne: userId };
        }

        const passes = await col('ticket_passes').find(query).sort({ created_at: -1 }).toArray();
        
        // Enrich with movie/booking details
        const enriched = await Promise.all(passes.map(async (p) => {
            const booking = await col('bookings').findOne({ id: p.booking_id });
            if (!booking) return null;

            const st = await col('showtimes').findOne({ id: booking.showtime_id });
            const mv = st ? await col('movies').findOne({ id: st.movie_id }) : null;

            return {
                ...p,
                movieTitle: mv?.title || 'Phim không tên',
                posterUrl: mv?.poster_url || null,
                start_time: st?.start_time || null,
                roomName: 'P.01', // Should fetch from room col if needed
            };
        }));

        res.json({ passes: enriched.filter(Boolean) });
    })
);

// POST /api/ticket-passes - List seats for resale
router.post(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
        const schema = z.object({
            bookingId: z.coerce.number(),
            seats: z.array(z.string().min(1)).min(1),
            pricePerSeat: z.coerce.number().min(1000),
        });

        const { bookingId, seats: inputSeats, pricePerSeat } = schema.parse(req.body);
        const userId = req.session.user.id;

        const booking = await col('bookings').findOne({ id: bookingId, user_id: userId });
        if (!booking) return res.status(404).json({ error: 'Không tìm thấy vé hợp lệ.' });
        if (booking.status !== 'SUCCESS') return res.status(400).json({ error: 'Chỉ có thể bán lại vé đã thanh toán thành công.' });

        const myOwnedSeats = (booking.seat_numbers || '').split(',');
        
        // Price check against original showtime
        const st = await col('showtimes').findOne({ id: booking.showtime_id });
        if (st) {
            const originalPrice = Number(st.price || 0);
            if (pricePerSeat > originalPrice) {
                return res.status(400).json({ error: `Giá bán (${pricePerSeat.toLocaleString()}đ) không được cao hơn giá gốc (${originalPrice.toLocaleString()}đ).` });
            }
        }

        // Validate all seats belong to booking
        for (const s of inputSeats) {
            if (!myOwnedSeats.includes(s)) {
                return res.status(400).json({ error: `Ghế ${s} không thuộc sở hữu của bạn.` });
            }
            // Check if already listed
            const existing = await col('ticket_passes').findOne({ 
                booking_id: bookingId, 
                seat_number: s, 
                status: 'AVAILABLE' 
            });
            if (existing) return res.status(400).json({ error: `Ghế ${s} đang được rao bán.` });
        }

        const passes = [];
        for (const s of inputSeats) {
            const passId = await nextId('ticket_passes');
            passes.push({
                id: passId,
                seller_id: userId,
                booking_id: bookingId,
                seat_number: s,
                price: pricePerSeat,
                status: 'AVAILABLE',
                created_at: new Date(),
            });
        }

        await col('ticket_passes').insertMany(passes);
        res.status(201).json({ message: `Đã đăng bán ${passes.length} ghế thành công!` });
    })
);

// POST /api/ticket-passes/:id/buy - Buy a pass
router.post(
    '/:id/buy',
    requireAuth,
    asyncHandler(async (req, res) => {
        const passId = Number(req.params.id);
        const buyerId = req.session.user.id;

        // Atomic lock for the pass
        const pass = await col('ticket_passes').findOneAndUpdate(
            { id: passId, status: 'AVAILABLE', seller_id: { $ne: buyerId } },
            { $set: { status: 'LOCKED_FOR_BUY' } }
        );

        if (!pass) return res.status(404).json({ error: 'Vé đã được bán hoặc không khả dụng.' });

        try {
            const buyer = await col('users').findOne({ id: buyerId });
            const seller = await col('users').findOne({ id: pass.seller_id });

            if (buyer.balance < pass.price) {
                await col('ticket_passes').updateOne({ id: passId }, { $set: { status: 'AVAILABLE' } });
                return res.status(400).json({ error: 'Số dư ví không đủ để mua vé này.' });
            }

            // TRANSACTIONS (Simplified simulate atomic)
            // 1. Update balances
            await col('users').updateOne({ id: buyerId }, { $inc: { balance: -pass.price } });
            await col('users').updateOne({ id: pass.seller_id }, { $inc: { balance: pass.price } });

            // 2. Split Booking
            const originalBooking = await col('bookings').findOne({ id: pass.booking_id });
            const remainingSeats = originalBooking.seat_numbers.split(',').filter(s => s !== pass.seat_number);
            
            if (remainingSeats.length === 0) {
                // Seller sells their last seat in this booking
                await col('bookings').updateOne({ id: pass.booking_id }, { $set: { status: 'TRANSFERRED' } });
            } else {
                await col('bookings').updateOne({ id: pass.booking_id }, { $set: { seat_numbers: remainingSeats.join(',') } });
            }

            // 3. Create New Booking for Buyer
            const newBookingId = await nextId('bookings');
            await col('bookings').insertOne({
                id: newBookingId,
                user_id: buyerId,
                showtime_id: originalBooking.showtime_id,
                customer_name: buyer.fullName,
                customer_email: buyer.email,
                seat_numbers: pass.seat_number,
                total_amount: pass.price,
                booking_time: new Date(),
                status: 'SUCCESS',
                booking_type: 'PASS_BUY',
                payment_method: 'WALLET',
                original_booking_id: originalBooking.id
            });

            // 4. Update Pass Status
            await col('ticket_passes').updateOne({ id: passId }, { 
                $set: { 
                    status: 'SOLD', 
                    buyer_id: buyerId, 
                    buyer_booking_id: newBookingId,
                    sold_at: new Date()
                } 
            });

            res.json({ message: 'Mua vé thành công! Vé đã được chuyển vào tài khoản của bạn.', bookingId: newBookingId });
        } catch (error) {
            // Rollback status if error
            await col('ticket_passes').updateOne({ id: passId }, { $set: { status: 'AVAILABLE' } });
            throw error;
        }
    })
);

// GET /api/ticket-passes/me - List my listings
router.get(
    '/me',
    requireAuth,
    asyncHandler(async (req, res) => {
        const userId = req.session.user.id;
        const myPasses = await col('ticket_passes').find({ seller_id: userId }).toArray();
        const enriched = await Promise.all(myPasses.map(async (p) => {
            const booking = await col('bookings').findOne({ id: p.booking_id });
            const st = booking ? await col('showtimes').findOne({ id: booking.showtime_id }) : null;
            const mv = st ? await col('movies').findOne({ id: st.movie_id }) : null;
            return {
                ...p,
                movieTitle: mv?.title || 'Phim không tên',
                posterUrl: mv?.poster_url || null,
                start_time: st?.start_time || null,
            };
        }));
        res.json({ passes: enriched });
    })
);

// POST /api/ticket-passes/:id/cancel - Cancel listing
router.post(
    '/:id/cancel',
    requireAuth,
    asyncHandler(async (req, res) => {
        const passId = Number(req.params.id);
        const userId = req.session.user.id;
        const result = await col('ticket_passes').updateOne(
            { id: passId, seller_id: userId, status: 'AVAILABLE' },
            { $set: { status: 'CANCELLED', cancelled_at: new Date() } }
        );
        if (result.matchedCount === 0) return res.status(404).json({ error: 'Không thể hủy vé này.' });
        res.json({ message: 'Đã hủy đăng bán thành công.' });
    })
);

export default router;
