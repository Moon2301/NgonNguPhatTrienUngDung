import nodemailer from 'nodemailer'
import dotenv from 'dotenv'
import { col } from '../db.js'

dotenv.config()

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

export async function sendTicketEmail({ booking, movie, showtime, room }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('Mail service not configured (missing EMAIL_USER or EMAIL_PASS)')
    return
  }

  const date = new Date(showtime?.start_time)
  const dateStr = date.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { margin: 0; padding: 0; background-color: #0a0a0a; color: #ffffff; }
        .container { max-width: 600px; margin: 40px auto; background-color: #121212; border-radius: 40px; overflow: hidden; box-shadow: 0 40px 100px rgba(0,0,0,0.8); border: 1px solid #222; }
        .header { background: linear-gradient(135deg, #000 0%, #1a0000 100%); padding: 50px 30px; text-align: center; border-bottom: 2px dashed #333; }
        .logo { color: #e50914; font-size: 32px; font-weight: 900; letter-spacing: 6px; margin-bottom: 10px; text-transform: uppercase; }
        .sub-logo { color: #888; font-size: 14px; letter-spacing: 2px; }
        .content { padding: 40px; position: relative; }
        .movie-title { font-size: 30px; font-weight: 900; color: #fff; margin: 0 0 10px; line-height: 1.2; }
        .movie-meta { color: #e50914; font-size: 14px; font-weight: 700; margin-bottom: 30px; text-transform: uppercase; letter-spacing: 1px; }
        .grid { display: block; width: 100%; border-bottom: 1px solid #222; padding-bottom: 30px; margin-bottom: 30px; }
        .item { display: inline-block; width: 45%; vertical-align: top; margin-bottom: 20px; }
        .label { font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px; }
        .value { font-size: 16px; font-weight: 800; color: #eee; }
        .value.highlight { color: #e50914; font-size: 24px; }
        .footer { background-color: #0a0a0a; padding: 30px; text-align: center; border-radius: 0 0 40px 40px; }
        .qr-placeholder { background: #fff; padding: 15px; border-radius: 15px; display: inline-block; margin-bottom: 20px; }
        .instructions { font-size: 12px; color: #555; line-height: 1.6; max-width: 80%; margin: 0 auto; }
        .amount-box { background: rgba(229, 9, 20, 0.1); border: 1px solid #e50914; border-radius: 20px; padding: 25px; text-align: center; margin-top: 20px; }
        .amount-label { color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 5px; }
        .amount-value { color: #fff; font-size: 32px; font-weight: 900; margin: 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">PELE CINEMA</div>
          <div class="sub-logo">TICKET CONFIRMATION</div>
        </div>
        
        <div class="content">
          <h2 class="movie-title">${movie?.title || 'Phim'}</h2>
          <div class="movie-meta">${room?.name || 'Phòng chiếu'} • ${movie?.duration || '---'} phút • ${showtime?.is_imax ? 'IMAX experience' : 'Standard 2D'}</div>
          
          <div class="grid">
            <div class="item">
              <div class="label">Ngày chiếu</div>
              <div class="value">${dateStr}</div>
            </div>
            <div class="item">
              <div class="label">Giờ bắt đầu</div>
              <div class="value highlight">${timeStr}</div>
            </div>
            <div class="item">
              <div class="label">Ghế ngồi</div>
              <div class="value">${booking.seat_numbers}</div>
            </div>
            <div class="item">
              <div class="label">Mã đặt vé</div>
              <div class="value">#${booking.id}</div>
            </div>
          </div>
          
          <div class="amount-box">
            <div class="amount-label">Tổng cộng</div>
            <div class="amount-value">${Number(booking.total_amount).toLocaleString()}đ</div>
          </div>
        </div>
        
        <div class="footer">
          <p class="instructions">Vui lòng đưa mã này cho nhân viên tại quầy để nhận vé cứng. Chúc bạn có những phút giây thư giãn tuyệt vời tại PELE Cinema.</p>
          <p style="color: #333; font-size: 11px; margin-top: 20px;">&copy; 2026 PELE Cinema Team. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `

  const mailOptions = {
    from: `"PELE Cinema" <${process.env.EMAIL_USER}>`,
    to: booking.customer_email,
    subject: `🎟️ [PELE CINEMA] Xác nhận vé thành công - #${booking.id}`,
    html: html,
  }

  try {
    const info = await transporter.sendMail(mailOptions)
    console.log('Email sent: ' + info.response)
    return info
  } catch (error) {
    console.error('Error sending email:', error)
    throw error
  }
}

export async function sendBookingEmail(bookingId) {
  try {
    const booking = await col('bookings').findOne({ id: bookingId })
    if (!booking) return

    const showtime = await col('showtimes').findOne({ id: booking.showtime_id })
    const movie = showtime ? await col('movies').findOne({ id: showtime.movie_id }) : null
    const room = showtime ? await col('rooms').findOne({ id: showtime.room_id }) : null

    await sendTicketEmail({ booking, movie, showtime, room })
  } catch (err) {
    console.error('Failed to send booking email:', err)
  }
}
