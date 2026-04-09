import crypto from 'crypto'
import express from 'express'
import { z } from 'zod'
import { col, nextId } from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = express.Router()

function getConfig() {
  const tmnCode = (process.env.VNPAY_TMN_CODE || '').trim()
  const hashSecret = (process.env.VNPAY_HASH_SECRET || '').trim()
  const vnpUrl = (process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html').trim()
  const returnUrl = (process.env.VNPAY_RETURN_URL || 'http://localhost:5173/payment/vnpay-return').trim()
  const orderType = (process.env.VNPAY_ORDER_TYPE || 'other').trim()
  const expireMinutes = Math.max(0, Number.parseInt(process.env.VNPAY_EXPIRE_MINUTES || '0', 10) || 0)
  return { tmnCode, hashSecret, vnpUrl, returnUrl, orderType, expireMinutes }
}

function formatVnPayDate(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (t) => parts.find((p) => p.type === t)?.value || ''
  return `${get('year')}${get('month')}${get('day')}${get('hour')}${get('minute')}${get('second')}`
}

function sortObject(obj) {
  return Object.keys(obj)
    .sort()
    .reduce((acc, k) => {
      acc[k] = obj[k]
      return acc
    }, {})
}

function buildQuery(params) {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    usp.append(k, String(v))
  }
  return usp.toString()
}

function signParams(sortedParams, hashSecret) {
  const signData = buildQuery(sortedParams)
  return crypto.createHmac('sha512', hashSecret).update(Buffer.from(signData, 'utf-8')).digest('hex')
}

router.post(
  '/create',
  asyncHandler(async (req, res) => {
    const cfg = getConfig()
    if (!cfg.tmnCode || !cfg.hashSecret) {
      return res.status(500).json({ error: 'Thiếu cấu hình VNPay (VNPAY_TMN_CODE/VNPAY_HASH_SECRET).' })
    }

    const schema = z.object({
      bookingId: z.coerce.number(),
      amount: z.coerce.number().min(0),
      orderInfo: z.string().min(1).max(255),
      returnUrl: z.string().optional().nullable(),
    })
    const input = schema.parse(req.body)

    const booking = await col('bookings').findOne({ id: input.bookingId })
    if (!booking) return res.status(404).json({ error: 'Booking không tồn tại.' })

    const bookingAmount = Number(booking.total_amount || 0)
    if (Number(input.amount) !== bookingAmount) {
      return res.status(400).json({ error: 'Số tiền không hợp lệ.' })
    }

    const txnRef = `BOOK_${booking.id}_${Date.now()}`
    const ipAddr = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1'
    const createDate = formatVnPayDate(new Date())

    const vnpParams = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: cfg.tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: input.orderInfo,
      vnp_OrderType: cfg.orderType,
      vnp_Amount: Math.round(bookingAmount * 100),
      vnp_ReturnUrl: (input.returnUrl || cfg.returnUrl).trim(),
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate,
    }

    if (cfg.expireMinutes > 0) {
      vnpParams.vnp_ExpireDate = formatVnPayDate(new Date(Date.now() + cfg.expireMinutes * 60000))
    }

    const sorted = sortObject(vnpParams)
    const secureHash = signParams(sorted, cfg.hashSecret)
    const url = `${cfg.vnpUrl}?${buildQuery({ ...sorted, vnp_SecureHash: secureHash })}`

    await col('payments').insertOne({
      id: await nextId('payments'),
      provider: 'VNPAY',
      purpose: 'BOOKING',
      status: 'CREATED',
      booking_id: booking.id,
      user_id: booking.user_id ?? null,
      amount: bookingAmount,
      txn_ref: txnRef,
      created_at: new Date(),
      updated_at: new Date(),
    })

    await col('bookings').updateOne(
      { id: booking.id },
      {
        $set: {
          payment_method: 'VNPAY',
          payment_status: 'CREATED',
          payment_txn_ref: txnRef,
        },
      },
    )

    res.status(201).json({ url, txnRef })
  }),
)

router.post(
  '/topup/create',
  requireAuth,
  asyncHandler(async (req, res) => {
    const cfg = getConfig()
    if (!cfg.tmnCode || !cfg.hashSecret) {
      return res.status(500).json({ error: 'Thiếu cấu hình VNPay (VNPAY_TMN_CODE/VNPAY_HASH_SECRET).' })
    }

    const schema = z.object({
      amount: z.coerce.number().min(1000),
      returnUrl: z.string().optional().nullable(),
    })
    const input = schema.parse(req.body)

    const amount = Math.round(Number(input.amount))
    const userId = req.session.user.id
    const txnRef = `TOPUP_${userId}_${Date.now()}`
    const ipAddr = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1'

    const vnpParams = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: cfg.tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: `Nạp ví #${userId}`,
      vnp_OrderType: cfg.orderType,
      vnp_Amount: Math.round(amount * 100),
      vnp_ReturnUrl: (input.returnUrl || cfg.returnUrl).trim(),
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: formatVnPayDate(new Date()),
    }

    if (cfg.expireMinutes > 0) {
      vnpParams.vnp_ExpireDate = formatVnPayDate(new Date(Date.now() + cfg.expireMinutes * 60000))
    }

    const sorted = sortObject(vnpParams)
    const secureHash = signParams(sorted, cfg.hashSecret)
    const url = `${cfg.vnpUrl}?${buildQuery({ ...sorted, vnp_SecureHash: secureHash })}`

    await col('payments').insertOne({
      id: await nextId('payments'),
      provider: 'VNPAY',
      purpose: 'TOPUP',
      status: 'CREATED',
      booking_id: null,
      user_id: userId,
      amount,
      txn_ref: txnRef,
      created_at: new Date(),
      updated_at: new Date(),
    })

    res.status(201).json({ url, txnRef })
  }),
)

router.get(
  '/return',
  asyncHandler(async (req, res) => {
    const cfg = getConfig()
    if (!cfg.hashSecret) return res.status(500).json({ error: 'Thiếu cấu hình VNPay (VNPAY_HASH_SECRET).' })

    const secureHash = String(req.query.vnp_SecureHash || '')
    const vnp = {}
    for (const [k, v] of Object.entries(req.query || {})) {
      if (!k.startsWith('vnp_')) continue
      if (k === 'vnp_SecureHash') continue
      vnp[k] = v
    }

    const sorted = sortObject(vnp)
    const signed = signParams(sorted, cfg.hashSecret)
    if (!secureHash || signed !== secureHash) {
      return res.status(400).json({ error: 'Chữ ký VNPay không hợp lệ.' })
    }

    const txnRef = String(req.query.vnp_TxnRef || '')
    const respCode = String(req.query.vnp_ResponseCode || '')
    const amount = Math.round((Number(req.query.vnp_Amount || 0) || 0) / 100)
    const success = respCode === '00'
    const newStatus = success ? 'SUCCESS' : 'FAILED'

    const pay = await col('payments').findOne({ provider: 'VNPAY', txn_ref: txnRef })
    if (!pay) return res.status(404).json({ error: 'Không tìm thấy giao dịch.' })

    await col('payments').updateOne(
      { id: pay.id },
      {
        $set: {
          status: newStatus,
          vnp_response_code: respCode,
          vnp_amount: amount,
          vnp_raw: req.query,
          updated_at: new Date(),
        },
      },
    )

    if (success) {
      if (pay.purpose === 'TOPUP') {
        await col('users').updateOne({ id: pay.user_id }, { $inc: { wallet: amount } })
        if (req.session?.user?.id === pay.user_id) {
          req.session.user.wallet = Number(req.session.user.wallet || 0) + amount
        }
      } else if (pay.purpose === 'BOOKING') {
        const booking = await col('bookings').findOne({ id: pay.booking_id })
        if (booking) {
          if (booking.promo_code) {
            const promo = await col('promotions').findOne({ code: booking.promo_code, active: true })
            if (promo) {
              if (promo.usage_limit == null) {
                await col('promotions').updateOne({ code: booking.promo_code }, { $inc: { usage_count: 1 } })
              } else {
                await col('promotions').updateOne(
                  { code: booking.promo_code, usage_count: { $lt: promo.usage_limit } },
                  { $inc: { usage_count: 1 } },
                )
              }
            }
          }

          await col('bookings').updateOne(
            { id: booking.id },
            { $set: { status: 'SUCCESS', payment_status: 'SUCCESS' } },
          )
        }
      }
    } else {
      if (pay.purpose === 'BOOKING' && pay.booking_id != null) {
        await col('bookings').updateOne({ id: pay.booking_id }, { $set: { status: 'FAILED', payment_status: 'FAILED' } })
      }
    }

    res.json({
      success,
      purpose: pay.purpose,
      bookingId: pay.booking_id,
      txnRef,
      responseCode: respCode,
    })
  }),
)

export default router

