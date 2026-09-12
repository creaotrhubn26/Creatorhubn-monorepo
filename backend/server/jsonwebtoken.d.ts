// jsonwebtoken har ikke medfølgende @types og pakken kan ikke legges til uten
// lockfil-endring. Ambient-deklarasjon gjør importen typet som any (unngår
// implicit-any i role-room-lti-service.ts). Overstyres automatisk hvis
// @types/jsonwebtoken senere installeres.
declare module "jsonwebtoken";
