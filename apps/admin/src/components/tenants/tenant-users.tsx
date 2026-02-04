"use client";

import { Plus, RefreshCw, User, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, type TenantUser, type CreateTenantUser } from "@/lib/api";

interface TenantUsersProps {
	tenantId: string;
	tenantStatus: string;
}

const roleColors: Record<string, string> = {
	admin: "bg-red-100 text-red-800",
	manager: "bg-purple-100 text-purple-800",
	cashier: "bg-blue-100 text-blue-800",
	kitchen: "bg-green-100 text-green-800",
};

export function TenantUsers({ tenantId, tenantStatus }: TenantUsersProps) {
	const [users, setUsers] = useState<TenantUser[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showCreateForm, setShowCreateForm] = useState(false);
	const [creating, setCreating] = useState(false);
	const [createError, setCreateError] = useState<string | null>(null);

	// Form state
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [name, setName] = useState("");
	const [role, setRole] = useState<CreateTenantUser["role"]>("cashier");

	const fetchUsers = useCallback(async () => {
		if (tenantStatus !== "running") {
			setLoading(false);
			return;
		}

		setLoading(true);
		setError(null);
		try {
			const { users: data } = await api.listTenantUsers(tenantId);
			setUsers(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch users");
		} finally {
			setLoading(false);
		}
	}, [tenantId, tenantStatus]);

	useEffect(() => {
		fetchUsers();
	}, [fetchUsers]);

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		setCreating(true);
		setCreateError(null);

		try {
			await api.createTenantUser(tenantId, {
				email,
				password,
				name: name || undefined,
				role,
			});
			setEmail("");
			setPassword("");
			setName("");
			setRole("cashier");
			setShowCreateForm(false);
			await fetchUsers();
		} catch (err) {
			setCreateError(err instanceof Error ? err.message : "Failed to create user");
		} finally {
			setCreating(false);
		}
	};

	if (tenantStatus !== "running") {
		return (
			<div className="rounded-md bg-amber-50 p-4 text-sm text-amber-700">
				Tenant must be running to manage users.
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h4 className="font-medium">Users ({users.length})</h4>
				<div className="flex gap-2">
					<Button
						size="sm"
						variant="outline"
						onClick={fetchUsers}
						disabled={loading}
					>
						<RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
						Refresh
					</Button>
					<Button
						size="sm"
						onClick={() => setShowCreateForm(!showCreateForm)}
					>
						<UserPlus className="h-4 w-4 mr-1" />
						Add User
					</Button>
				</div>
			</div>

			{error && (
				<div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
					{error}
				</div>
			)}

			{showCreateForm && (
				<form onSubmit={handleCreate} className="rounded-lg border p-4 space-y-4">
					<h5 className="font-medium">Create New User</h5>

					{createError && (
						<div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
							{createError}
						</div>
					)}

					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<label className="text-sm font-medium">Email *</label>
							<input
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
								placeholder="user@example.com"
							/>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium">Password *</label>
							<input
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								minLength={8}
								className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
								placeholder="Minimum 8 characters"
							/>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium">Name</label>
							<input
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
								placeholder="John Doe"
							/>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium">Role</label>
							<select
								value={role}
								onChange={(e) => setRole(e.target.value as CreateTenantUser["role"])}
								className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
							>
								<option value="cashier">Cashier</option>
								<option value="kitchen">Kitchen</option>
								<option value="manager">Manager</option>
								<option value="admin">Admin</option>
							</select>
						</div>
					</div>

					<div className="flex justify-end gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => setShowCreateForm(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={creating}>
							{creating ? "Creating..." : "Create User"}
						</Button>
					</div>
				</form>
			)}

			{loading ? (
				<div className="flex items-center justify-center py-8">
					<div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
				</div>
			) : users.length === 0 ? (
				<div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center">
					<User className="mx-auto h-10 w-10 text-zinc-400" />
					<p className="mt-2 text-zinc-500">No users yet</p>
					<p className="text-sm text-zinc-400">
						Create your first user to get started
					</p>
				</div>
			) : (
				<div className="space-y-2">
					{users.map((user) => (
						<div
							key={user.id}
							className="flex items-center justify-between rounded-lg border p-3"
						>
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100">
									<User className="h-5 w-5 text-zinc-600" />
								</div>
								<div>
									<p className="font-medium">
										{user.name || user.email.split("@")[0]}
									</p>
									<p className="text-sm text-zinc-500">{user.email}</p>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<Badge className={roleColors[user.role] || ""}>
									{user.role}
								</Badge>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
