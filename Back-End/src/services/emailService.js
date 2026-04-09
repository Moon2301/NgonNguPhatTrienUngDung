import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
    },
});

/**
 * Gửi email vé xem phim cho khách hàng
 * @param {Object} booking 
 * @param {Object} movie 
 * @param {Object} showtime 
 * @param {Object} room 
 */
export async function sendTicketEmail(booking, movie, showtime, room) {
    if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
        console.warn('[EMAIL SERVICE] Bỏ qua gửi email vì chưa cấu hình MAIL_USER/MAIL_PASS');
        return;
    }

    const date = new Date(showtime.start_time);
    const dateStr = date.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    // Link to public ticket view (assuming absolute URL)
    const ticketUrl = `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/ticket/view/${booking.id}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(ticketUrl)}`;

    const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
        <div style="background-color: #e50914; padding: 30px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px;">Vé Xem Phim Của Bạn</h1>
            <p style="margin-top: 10px; opacity: 0.8;">Cảm ơn bạn đã đặt vé tại PELE Cinema</p>
        </div>
        
        <div style="padding: 40px; background-color: white;">
            <div style="display: flex; margin-bottom: 30px;">
                <img src="${movie.poster_url}" style="width: 120px; height: 180px; border-radius: 10px; object-fit: cover; box-shadow: 0 5px 15px rgba(0,0,0,0.2);" />
                <div style="margin-left: 25px;">
                    <h2 style="margin: 0 0 10px; color: #111; font-size: 22px;">${movie.title}</h2>
                    <p style="margin: 5px 0; color: #666; font-size: 14px;">Thời lượng: <strong>${movie.duration} phút</strong></p>
                    <p style="margin: 5px 0; color: #666; font-size: 14px;">Phòng chiếu: <strong>${room.name}</strong></p>
                    <div style="margin-top: 15px; background-color: #fff5f5; padding: 10px 15px; border-radius: 8px; border-left: 4px solid #e50914;">
                        <span style="display: block; font-size: 12px; color: #e50914; font-weight: bold; text-transform: uppercase;">Giờ chiếu</span>
                        <span style="font-size: 18px; font-weight: 800; color: #e50914;">${timeStr}</span>
                        <span style="font-size: 14px; color: #666; margin-left: 10px;">${dateStr}</span>
                    </div>
                </div>
            </div>
            
            <div style="border-top: 1px dashed #ddd; border-bottom: 1px dashed #ddd; padding: 20px 0; margin-bottom: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <p style="margin: 0; font-size: 12px; color: #999; text-transform: uppercase;">Mã vé</p>
                    <p style="margin: 5px 0; font-weight: bold; font-size: 16px;">#${booking.id}</p>
                </div>
                <div>
                    <p style="margin: 0; font-size: 12px; color: #999; text-transform: uppercase;">Số ghế</p>
                    <p style="margin: 5px 0; font-weight: bold; font-size: 16px; color: #e50914;">${booking.seat_numbers}</p>
                </div>
                <div>
                    <p style="margin: 0; font-size: 12px; color: #999; text-transform: uppercase;">Khách hàng</p>
                    <p style="margin: 5px 0; font-weight: bold; font-size: 16px;">${booking.customer_name}</p>
                </div>
                <div>
                    <p style="margin: 0; font-size: 12px; color: #999; text-transform: uppercase;">Tổng tiền</p>
                    <p style="margin: 5px 0; font-weight: bold; font-size: 16px;">${booking.total_amount.toLocaleString()}đ</p>
                </div>
            </div>
            
            <div style="text-align: center;">
                <p style="color: #666; font-size: 13px; margin-bottom: 15px;">Vui lòng đưa mã QR dưới đây cho nhân viên tại quầy để soát vé:</p>
                <div style="display: inline-block; padding: 15px; background: white; border: 1px solid #eee; border-radius: 15px;">
                    <img src="${qrUrl}" alt="QR Code" style="display: block;" />
                </div>
                <p style="margin-top: 20px;">
                    <a href="${ticketUrl}" style="background-color: #111; color: white; text-decoration: none; padding: 12px 25px; border-radius: 10px; font-weight: bold; font-size: 14px;">Xem vé trực tuyến</a>
                </p>
            </div>
        </div>
        
        <div style="padding: 20px; text-align: center; background-color: #f0f0f0; color: #999; font-size: 11px;">
            <p>Đây là email tự động, vui lòng không phản hồi email này.</p>
            <p>&copy; 2026 PELE Cinema. All rights reserved.</p>
        </div>
    </div>
    `;

    const mailOptions = {
        from: `"PELE Cinema" <${process.env.MAIL_USER}>`,
        to: booking.customer_email,
        subject: `[PELE Cinema] Mọi thứ đã sẵn sàng! Vé xem phim #${booking.id} - ${movie.title}`,
        html: htmlContent,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('[EMAIL SERVICE] Đã gửi email: ' + info.messageId);
        return info;
    } catch (error) {
        console.error('[EMAIL SERVICE] Lỗi gửi email:', error);
        throw error;
    }
}
