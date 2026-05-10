/**
 * role-room-commercial-access-error.ts
 *
 * Eksponert error-klasse for kommersiell-tilgang-flyten i The Role Room.
 * Trenger å være importerbar fra både index.ts (der `ensureRoleRoomCommercialAccess`-
 * funksjonen kaster den) og fra route-modulen som fanger den med `instanceof`.
 *
 * Holdes som egen liten fil for å unngå sirkulære avhengigheter mellom
 * service-laget og route-laget.
 */

export class RoleRoomCommercialAccessError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}
