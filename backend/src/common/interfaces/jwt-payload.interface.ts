/** Claims we put into access tokens. `sub` is the user id (JWT convention). */
export interface AccessTokenPayload {
  sub: string;
  email: string;
}

/** Claims we put into refresh tokens. `jti` makes every token unique. */
export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

/** What the auth guard attaches to `request.user` after verifying a token. */
export interface AuthUser {
  id: string;
  email: string;
}
