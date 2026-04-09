import crypto from 'crypto'
import express from 'express'
import { z } from 'zod'
import { col } from '../db.js'
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

/** Giống package `vnpay`: chỉ ký trên chuỗi query do URLSearchParams tạo (không tự encode kiểu khác). */
function buildSortedSearchParams(obj) {
  const params = new URLSearchParams()
  const sortedKeys = Object.keys(obj).sort()
  for (const key of sortedKeys) {
    const val = obj[key]
    if (val !== undefined && val !== null && val !== '') params.append(key, String(val))
  }
  return params
}

function signSearchQueryString(queryString, secret) {
  return crypto.createHmac('sha512', secret).update(Buffer.from(queryString, 'utf-8')).digest('hex')
}

/** yyyyMMddHHmmss theo giờ Asia/Ho_Chi_Minh (sandbox VNPay yêu cầu). */
function formatVnpDateVN(d = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
      .formatToParts(d)
      .filter((x) => x.type !== 'literal')
      .map((x) => [x.type, x.value]),
  )
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`
}

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for']
  let ip =
    typeof xf === 'string' && xf.trim()
      ? xf.split(',')[0].trim()
      : req.socket?.remoteAddress || '127.0.0.1'
  if (ip.startsWith('::ffff:')) ip = ip.slice(7)
  if (ip === '::1') ip = '127.0.0.1'
  return ip
}

router.post(
  '/create',
  asyncHandler(async (req, res) => {
    const cfg = getConfig()
    if (!cfg.tmnCode || !cfg.hashSecret) {
      return res.status(500).json({ error: 'Thiếu cấu hình VNPay (VNPAY_TMN_CODE/VNPAY_HASH_SECRET).' })
    }

    const schema = z.object({
      bookingId: z.coerce.number().int().min(1),
      amount: z.coerce.number().min(0),
      orderInfo: z.string().optional(),
      returnUrl: z.string().url().optional(),
    })
    const input = schema.parse(req.body)

    const booking = await col('bookings').findOne({ id: input.bookingId })
    if (!booking) return res.status(404).json({ error: 'Booking không tồn tại.' })

    const now = new Date()
    const txnRef = `${input.bookingId}_${now.getTime()}`
    const vnpParams = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: cfg.tmnCode,
      vnp_Amount: Math.round(Number(input.amount) * 100),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: input.orderInfo || `Thanh toan booking #${input.bookingId}`,
      vnp_OrderType: cfg.orderType,
      vnp_Locale: 'vn',
      vnp_ReturnUrl: input.returnUrl || cfg.returnUrl,
      vnp_IpAddr: getClientIp(req),
      vnp_CreateDate: formatVnpDateVN(now),
    }
    if (cfg.expireMinutes > 0) {
      vnpParams.vnp_ExpireDate = formatVnpDateVN(new Date(now.getTime() + cfg.expireMinutes * 60 * 1000))
    }

    const params = buildSortedSearchParams(vnpParams)
    const signData = params.toString()
    const secureHash = signSearchQueryString(signData, cfg.hashSecret)
    params.append('vnp_SecureHash', secureHash)
    const url = `${cfg.vnpUrl}?${params.toString()}`

    await col('payments').insertOne({
      provider: 'VNPAY',
      booking_id: input.bookingId,
      txn_ref: txnRef,
      amount: Number(input.amount),
      status: 'CREATED',
      created_at: new Date(),
    })

    await col('bookings').updateOne(
      { id: input.bookingId },
      { $set: { payment_method: 'VNPAY', payment_status: 'CREATED', payment_txn_ref: txnRef, updated_at: new Date() } },
    )

    return res.json({ url, txnRef })
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
      orderInfo: z.string().optional(),
      returnUrl: z.string().url().optional(),
    })
    const input = schema.parse(req.body)

    const userId = req.session.user.id
    const now = new Date()
    const amount = Math.round(Number(input.amount || 0))
    const txnRef = `TOPUP_${userId}_${now.getTime()}`

    const vnpParams = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: cfg.tmnCode,
      vnp_Amount: Math.round(amount * 100),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: input.orderInfo || `NAP_VI_${amount}_${userId}`,
      vnp_OrderType: cfg.orderType,
      vnp_Locale: 'vn',
      vnp_ReturnUrl: input.returnUrl || cfg.returnUrl,
      vnp_IpAddr: getClientIp(req),
      vnp_CreateDate: formatVnpDateVN(now),
    }
    if (cfg.expireMinutes > 0) {
      vnpParams.vnp_ExpireDate = formatVnpDateVN(new Date(now.getTime() + cfg.expireMinutes * 60 * 1000))
    }

    const params = buildSortedSearchParams(vnpParams)
    const signData = params.toString()
    const secureHash = signSearchQueryString(signData, cfg.hashSecret)
    params.append('vnp_SecureHash', secureHash)
    const url = `${cfg.vnpUrl}?${params.toString()}`

    await col('payments').insertOne({
      provider: 'VNPAY',
      purpose: 'TOPUP',
      user_id: userId,
      booking_id: null,
      txn_ref: txnRef,
      amount,
      status: 'CREATED',
      created_at: new Date(),
    })

    return res.json({ url, txnRef })
  }),
)

router.get(
  '/return',
  asyncHandler(async (req, res) => {
    const cfg = getConfig()
    if (!cfg.hashSecret) return res.status(500).json({ error: 'Thiếu cấu hình VNPay (VNPAY_HASH_SECRET).' })

    // VNPay chỉ ký trên các field vnp_*
    const secureHash = String(req.query.vnp_SecureHash || '').trim()
    const fields = {}
    for (const [k, v] of Object.entries(req.query || {})) {
      if (!k.startsWith('vnp_')) continue
      if (k === 'vnp_SecureHash' || k === 'vnp_SecureHashType') continue
      fields[k] = Array.isArray(v) ? v[0] : v
    }

    const returnParams = buildSortedSearchParams(fields)
    const expected = signSearchQueryString(returnParams.toString(), cfg.hashSecret)
    if (!secureHash || secureHash.toLowerCase() !== expected.toLowerCase()) {
      return res.status(400).json({ ok: false, error: 'Sai chữ ký VNPay.' })
    }

    const txnRef = String(req.query.vnp_TxnRef || '')
    const respCode = String(req.query.vnp_ResponseCode || '')
    const amount = Number(req.query.vnp_Amount || 0) / 100

    const pay = await col('payments').findOne({ provider: 'VNPAY', txn_ref: txnRef })
    if (!pay) return res.status(404).json({ ok: false, error: 'Không tìm thấy giao dịch.' })

    const isSuccess = respCode === '00'
    const newStatus = isSuccess ? 'SUCCESS' : 'FAILED'

    await col('payments').updateOne(
      { _id: pay._id },
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

    if (isSuccess) {
      if (pay.purpose === 'TOPUP') {
        const inc = Math.round(Number(pay.amount || amount || 0))
        if (inc > 0 && pay.user_id) {
          await col('users').updateOne({ id: Number(pay.user_id) }, { $inc: { wallet: inc } })
          if (req.session?.user?.id && Number(req.session.user.id) === Number(pay.user_id)) {
            req.session.user.wallet = Number(req.session.user.wallet || 0) + inc
          }
        }
        return res.json({
          ok: true,
          success: true,
          purpose: 'TOPUP',
          amount: inc,
        })
      }

      // increment promo usage if applied (best-effort + atomic limit check)
      const booking = await col('bookings').findOne({ id: pay.booking_id }, { projection: { promo_code: 1 } })
      const code = String(booking?.promo_code || '').trim()
      if (code) {
        const promo = await col('promotions').findOne({ code }, { projection: { usage_limit: 1, usage_count: 1 } })
        if (promo) {
          const limit = promo.usage_limit == null ? null : Number(promo.usage_limit)
          const used = promo.usage_count == null ? 0 : Number(promo.usage_count)
          if (limit == null || !Number.isFinite(limit) || limit < 0) {
            await col('promotions').updateOne({ code }, { $inc: { usage_count: 1 } })
          } else if (used < limit) {
            // usage_count có thể bị thiếu/null ở dữ liệu cũ → vẫn cho phép dùng và tự tạo field khi $inc
            const ok = await col('promotions').updateOne(
              { code, $or: [{ usage_count: { $exists: false } }, { usage_count: { $lt: limit } }] },
              { $inc: { usage_count: 1 } },
            )
            if (!ok?.modifiedCount) {
              await col('bookings').updateOne(
                { id: pay.booking_id },
                { $set: { status: 'FAILED', payment_status: 'FAILED', updated_at: new Date() } },
              )
              return res.json({ ok: true, success: false, bookingId: pay.booking_id, txnRef, responseCode: 'PROMO_LIMIT' })
            }
          } else {
            await col('bookings').updateOne(
              { id: pay.booking_id },
              { $set: { status: 'FAILED', payment_status: 'FAILED', updated_at: new Date() } },
            )
            return res.json({ ok: true, success: false, bookingId: pay.booking_id, txnRef, responseCode: 'PROMO_LIMIT' })
          }
        }
      }
      await col('bookings').updateOne(
        { id: pay.booking_id },
        { $set: { status: 'SUCCESS', payment_status: 'SUCCESS', updated_at: new Date() } },
      )
    } else {
      if (pay.purpose === 'TOPUP') {
        return res.json({ ok: true, success: false, purpose: 'TOPUP', responseCode: respCode })
      }
      await col('bookings').updateOne(
        { id: pay.booking_id },
        { $set: { status: 'FAILED', payment_status: newStatus, updated_at: new Date() } },
      )
    }

    return res.json({
      ok: true,
      success: isSuccess,
      purpose: pay.purpose || 'BOOKING',
      bookingId: pay.booking_id,
      txnRef,
      responseCode: respCode,
    })
  }),
)

export default router

