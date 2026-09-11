import type { UserRole } from "./userModel.js";

declare global {
	namespace Express {
		interface Request {
			user?: {
				id: number;
				email: string;
				name: string;
				role: UserRole;
				emailVerifiedAt: Date | null;
			};
		}
	}
}
