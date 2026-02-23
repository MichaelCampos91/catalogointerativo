import * as jose from "jose"
import { NextResponse } from "next/server"

const JWT_SECRET = process.env.JWT_SECRET || "catalogo-admin-secret-change-in-production"

export interface TokenPayload {
  sub: string
}

const getSecret = () => new TextEncoder().encode(JWT_SECRET)

export async function generateToken(payload: TokenPayload): Promise<string> {
  const secret = getSecret()
  return await new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret)
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const secret = getSecret()
  const { payload } = await jose.jwtVerify(token, secret)
  return { sub: payload.sub as string }
}

export function getAuthTokenFromRequest(
  request: Request,
  cookieToken?: string | null
): string | null {
  const authHeader = request.headers.get("authorization")
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7)
  }
  return cookieToken ?? null
}

export async function requireAuth(
  request: Request,
  cookieToken?: string | null
): Promise<TokenPayload> {
  const token = getAuthTokenFromRequest(request, cookieToken)
  if (!token) {
    throw new Error("Token não fornecido")
  }
  try {
    return await verifyToken(token)
  } catch {
    throw new Error("Token inválido ou expirado")
  }
}

export function authErrorResponse(
  message: string = "Token não fornecido",
  status: number = 401
): NextResponse {
  return NextResponse.json({ error: message }, { status })
}
