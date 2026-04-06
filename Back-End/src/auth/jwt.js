import jwt from "jsonwebtoken";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET");
  return secret;
}

export function signAccessToken(payload) {
  const expiresIn = process.env.JWT_EXPIRES_IN ?? "7d";
  return jwt.sign(payload, getJwtSecret(), { expiresIn });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, getJwtSecret());
}

