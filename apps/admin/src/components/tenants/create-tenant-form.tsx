"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	api,
	type CreateTenantInput,
	DOMAIN,
	type PlatformImage,
} from "@/lib/api";

export function CreateTenantForm() {
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [images, setImages] = useState<PlatformImage[]>([]);
	const [loadingImages, setLoadingImages] = useState(true);
	const [formData, setFormData] = useState<CreateTenantInput>({
		name: "",
		slug: "",
		subdomain: "",
		adminEmail: "",
		adminPassword: "",
		version: "",
	});

	useEffect(() => {
		async function loadImages() {
			try {
				const { images: availableImages } = await api.listImages();
				setImages(availableImages.filter((img) => !img.isDeprecated));
				// Set default to latest version
				const latest = availableImages.find((img) => img.isLatest);
				if (latest) {
					setFormData((prev) => ({ ...prev, version: latest.version }));
				}
			} catch (err) {
				console.error("Failed to load images:", err);
			} finally {
				setLoadingImages(false);
			}
		}
		loadImages();
	}, []);

	const handleNameChange = (name: string) => {
		const slug = name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "");
		setFormData((prev) => ({
			...prev,
			name,
			slug,
			subdomain: slug,
		}));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError(null);

		try {
			const { tenant } = await api.createTenant(formData);
			router.push(`/tenants/${tenant.id}`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create tenant");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Card className="max-w-2xl">
			<CardHeader>
				<CardTitle>Create New Tenant</CardTitle>
				<CardDescription>
					Set up a new tenant with their own Medusa instance
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="space-y-6">
					{error && (
						<div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
							{error}
						</div>
					)}

					<div className="space-y-2">
						<Label htmlFor="name">Tenant Name</Label>
						<Input
							id="name"
							placeholder="My Store"
							value={formData.name}
							onChange={(e) => handleNameChange(e.target.value)}
							required
						/>
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="slug">Slug</Label>
							<Input
								id="slug"
								placeholder="my-store"
								value={formData.slug}
								onChange={(e) =>
									setFormData((prev) => ({ ...prev, slug: e.target.value }))
								}
								pattern="^[a-z0-9-]+$"
								required
							/>
							<p className="text-xs text-zinc-500">
								Used for internal identification
							</p>
						</div>

						<div className="space-y-2">
							<Label htmlFor="subdomain">Subdomain</Label>
							<div className="flex items-center">
								<Input
									id="subdomain"
									placeholder="my-store"
									value={formData.subdomain}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											subdomain: e.target.value,
										}))
									}
									pattern="^[a-z0-9-]+$"
									required
									className="rounded-r-none"
								/>
								<span className="flex h-10 items-center rounded-r-md border border-l-0 border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-500">
									.{DOMAIN}
								</span>
							</div>
						</div>
					</div>

					<div className="border-t pt-6">
						<h4 className="mb-4 font-medium">Medusa Version</h4>
						<div className="space-y-2">
							<Label htmlFor="version">Version</Label>
							<select
								id="version"
								value={formData.version || ""}
								onChange={(e) =>
									setFormData((prev) => ({ ...prev, version: e.target.value }))
								}
								disabled={loadingImages}
								className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{loadingImages ? (
									<option value="">Loading versions...</option>
								) : images.length === 0 ? (
									<option value="">
										No versions available (using default)
									</option>
								) : (
									<>
										<option value="">Select a version</option>
										{images.map((image) => (
											<option key={image.id} value={image.version}>
												{image.version}
												{image.isLatest && " (Latest)"}
												{image.createdAt &&
													` - ${new Date(image.createdAt).toLocaleDateString()}`}
											</option>
										))}
									</>
								)}
							</select>
							<p className="text-xs text-zinc-500">
								Select the Medusa version for this tenant. Leave empty to use
								the default image.
							</p>
						</div>
					</div>

					<div className="border-t pt-6">
						<h4 className="mb-4 font-medium">Admin Credentials</h4>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="adminEmail">Admin Email</Label>
								<Input
									id="adminEmail"
									type="email"
									placeholder="admin@example.com"
									value={formData.adminEmail}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											adminEmail: e.target.value,
										}))
									}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="adminPassword">Admin Password</Label>
								<Input
									id="adminPassword"
									type="password"
									placeholder="Min 8 characters"
									value={formData.adminPassword}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											adminPassword: e.target.value,
										}))
									}
									minLength={8}
								/>
							</div>
						</div>
					</div>

					<div className="flex justify-end gap-4 pt-4">
						<Button
							type="button"
							variant="outline"
							onClick={() => router.back()}
						>
							Cancel
						</Button>
						<Button type="submit" loading={loading}>
							Create Tenant
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
