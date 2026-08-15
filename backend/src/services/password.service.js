import { Algorithm, Version, hash, verify } from "@node-rs/argon2";

export function createPasswordService(config) {
  const options = Object.freeze({
    algorithm: Algorithm.Argon2id,
    memoryCost: config.AUTH_PASSWORD_MEMORY_COST_KIB,
    outputLen: 32,
    parallelism: config.AUTH_PASSWORD_PARALLELISM,
    timeCost: config.AUTH_PASSWORD_TIME_COST,
    version: Version.V0x13,
  });

  return Object.freeze({
    hash(password) {
      return hash(password, options);
    },
    verify(passwordHash, password) {
      return verify(passwordHash, password);
    },
  });
}
