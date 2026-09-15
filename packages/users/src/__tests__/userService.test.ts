import type { User as PrismaUser } from "@alxarafe/database";
import { StatusCodes } from "http-status-codes";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserRepository } from "../userRepository.js";
import { UserService } from "../userService.js";

function buildUser(overrides: Partial<PrismaUser> = {}): PrismaUser {
	return {
		id: 1,
		name: "Ada",
		email: "ada@example.com",
		role: "USER",
		emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		...overrides,
	};
}

describe("UserService.updateUser", () => {
	let repo: UserRepository;

	beforeEach(() => {
		repo = {
			findByIdAsync: vi.fn(),
			findByEmailAsync: vi.fn(),
			updateAsync: vi.fn(),
		} as unknown as UserRepository;
	});

	it("returns 404 when the user does not exist", async () => {
		vi.mocked(repo.findByIdAsync).mockResolvedValue(null);
		const service = new UserService(repo);

		const res = await service.updateUser(1, { name: "Ada" });

		expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
		expect(res.message).toBe("User not found");
		expect(repo.updateAsync).not.toHaveBeenCalled();
	});

	it("updates only the name when name is provided", async () => {
		vi.mocked(repo.findByIdAsync).mockResolvedValue(buildUser());
		vi.mocked(repo.updateAsync).mockResolvedValue(buildUser({ name: "Grace" }));
		const service = new UserService(repo);

		const res = await service.updateUser(1, { name: "Grace" });

		expect(res.success).toBe(true);
		expect(repo.updateAsync).toHaveBeenCalledWith(1, { name: "Grace" });
		expect(res.responseObject?.name).toBe("Grace");
	});

	it("rejects an email already in use by another user with 409", async () => {
		vi.mocked(repo.findByIdAsync).mockResolvedValue(buildUser());
		vi.mocked(repo.findByEmailAsync).mockResolvedValue(buildUser({ id: 9, email: "taken@example.com" }));
		const service = new UserService(repo);

		const res = await service.updateUser(1, { email: "taken@example.com" });

		expect(res.statusCode).toBe(StatusCodes.CONFLICT);
		expect(res.message).toBe("Email is already in use");
		expect(repo.updateAsync).not.toHaveBeenCalled();
	});

	it("keeps the email when it is unchanged and does not reset verification", async () => {
		vi.mocked(repo.findByIdAsync).mockResolvedValue(buildUser());
		vi.mocked(repo.updateAsync).mockResolvedValue(buildUser());
		const service = new UserService(repo);

		const res = await service.updateUser(1, { name: "Babbage", email: "ADA@example.com" });

		expect(res.success).toBe(true);
		expect(repo.updateAsync).toHaveBeenCalledWith(1, { name: "Babbage" });
		expect(res.responseObject?.emailVerifiedAt).not.toBeNull();
	});

	it("normalizes the new email, resets verification and checks duplicates case-insensitively", async () => {
		vi.mocked(repo.findByIdAsync).mockResolvedValue(buildUser());
		vi.mocked(repo.findByEmailAsync).mockResolvedValue(null);
		vi.mocked(repo.updateAsync).mockResolvedValue(buildUser({ email: "grace@hoppers.org", emailVerifiedAt: null }));
		const service = new UserService(repo);

		const res = await service.updateUser(1, { email: "Grace@Hoppers.org" });

		expect(res.success).toBe(true);
		expect(repo.findByEmailAsync).toHaveBeenCalledWith("grace@hoppers.org");
		expect(repo.updateAsync).toHaveBeenCalledWith(1, { email: "grace@hoppers.org", emailVerifiedAt: null });
		expect(res.responseObject?.emailVerifiedAt).toBeNull();
	});

	it("returns 500 when the repository throws", async () => {
		vi.mocked(repo.findByIdAsync).mockResolvedValue(buildUser());
		vi.mocked(repo.updateAsync).mockRejectedValue(new Error("boom"));
		const service = new UserService(repo);

		const res = await service.updateUser(1, { name: "Grace" });

		expect(res.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
		expect(res.message).toBe("An error occurred while updating user.");
	});
});
