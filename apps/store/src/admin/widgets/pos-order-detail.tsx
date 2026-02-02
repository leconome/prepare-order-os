import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import {
  Container,
  Heading,
  Text,
  Badge,
  Button,
  Select,
  Drawer,
  Label,
  Input,
  Textarea,
  toast,
  FocusModal,
} from "@medusajs/ui"
import { Plus } from "@medusajs/icons"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { sdk } from "../lib/client"

type PosOrder = {
  id: string
  ticket_number: string
  payment_status: "pending" | "paid" | "partially_paid" | "refunded"
  preparation_status: "pending" | "in_preparation" | "ready" | "picked_up"
  pickup_date: string | null
  pickup_time_start: string | null
  pickup_time_end: string | null
  client_note: string | null
  internal_note: string | null
  order_id: string
  created_by: {
    id: string
    first_name: string
    last_name: string
  } | null
  assigned_to: {
    id: string
    first_name: string
    last_name: string
  } | null
  created_at: string
}

type Employee = {
  id: string
  first_name: string
  last_name: string
  role: string
  is_active: boolean
}

const PAYMENT_STATUS_OPTIONS = [
  { value: "pending", label: "En attente" },
  { value: "paid", label: "Payé" },
  { value: "partially_paid", label: "Partiellement payé" },
  { value: "refunded", label: "Remboursé" },
]

const PREPARATION_STATUS_OPTIONS = [
  { value: "pending", label: "En attente", color: "grey" as const },
  { value: "in_preparation", label: "En préparation", color: "orange" as const },
  { value: "ready", label: "Prêt", color: "green" as const },
  { value: "picked_up", label: "Récupéré", color: "blue" as const },
]

const PAYMENT_STATUS_COLORS = {
  pending: "orange" as const,
  paid: "green" as const,
  partially_paid: "blue" as const,
  refunded: "red" as const,
}

const PosOrderDetailWidget = ({
  data: order,
}: DetailWidgetProps<HttpTypes.AdminOrder>) => {
  const [editOpen, setEditOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [formData, setFormData] = useState({
    payment_status: "",
    pickup_date: "",
    pickup_time_start: "",
    pickup_time_end: "",
    client_note: "",
    internal_note: "",
    assigned_to_id: "",
  })
  const [createFormData, setCreateFormData] = useState({
    created_by_id: "",
    assigned_to_id: "",
    pickup_date: "",
    pickup_time_start: "",
    pickup_time_end: "",
    client_note: "",
    internal_note: "",
  })
  const queryClient = useQueryClient()

  // Fetch POS order for this order
  const { data: posOrderData, isLoading } = useQuery({
    queryFn: async () => {
      const response = await sdk.client.fetch<{
        pos_orders: PosOrder[]
        count: number
      }>(`/admin/pos/orders?limit=100`)
      // Find POS order matching this Medusa order
      const posOrder = response.pos_orders.find((po) => po.order_id === order.id)
      return posOrder || null
    },
    queryKey: ["pos-order-detail", order.id],
  })

  // Fetch employees for assignment (always fetch for create modal)
  const { data: employeesData } = useQuery({
    queryFn: async () => {
      const response = await sdk.client.fetch<{
        employees: Employee[]
      }>("/admin/pos/employees")
      return response.employees.filter((e) => e.is_active)
    },
    queryKey: ["pos-employees-active"],
  })

  // Create POS order mutation
  const createPosOrder = useMutation({
    mutationFn: async (data: Omit<typeof createFormData, "assigned_to_id"> & { order_id: string; assigned_to_id?: string }) => {
      const response = await sdk.client.fetch<{ pos_order: PosOrder }>(
        "/admin/pos/orders",
        {
          method: "POST",
          body: data,
        }
      )
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos-order-detail", order.id] })
      queryClient.invalidateQueries({ queryKey: ["pos-orders-list"] })
      toast.success("Commande POS créée")
      setCreateOpen(false)
      setCreateFormData({
        created_by_id: "",
        assigned_to_id: "",
        pickup_date: "",
        pickup_time_start: "",
        pickup_time_end: "",
        client_note: "",
        internal_note: "",
      })
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erreur lors de la création")
    },
  })

  // Update POS order mutation
  const updatePosOrder = useMutation({
    mutationFn: async (data: Partial<typeof formData>) => {
      if (!posOrderData) return null
      const response = await sdk.client.fetch<{ pos_order: PosOrder }>(
        `/admin/pos/orders/${posOrderData.id}`,
        {
          method: "POST",
          body: data,
        }
      )
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos-order-detail", order.id] })
      queryClient.invalidateQueries({ queryKey: ["pos-orders-list"] })
      toast.success("Commande mise à jour")
      setEditOpen(false)
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erreur lors de la mise à jour")
    },
  })

  // Quick status update mutation
  const updateStatus = useMutation({
    mutationFn: async (data: {
      payment_status?: string
      preparation_status?: string
    }) => {
      if (!posOrderData) return null
      const response = await sdk.client.fetch<{ pos_order: PosOrder }>(
        `/admin/pos/orders/${posOrderData.id}`,
        {
          method: "POST",
          body: data,
        }
      )
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos-order-detail", order.id] })
      queryClient.invalidateQueries({ queryKey: ["pos-orders-list"] })
      toast.success("Statut mis à jour")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erreur lors de la mise à jour")
    },
  })

  const handleOpenEdit = () => {
    if (posOrderData) {
      setFormData({
        payment_status: posOrderData.payment_status,
        pickup_date: posOrderData.pickup_date
          ? new Date(posOrderData.pickup_date).toISOString().split("T")[0]
          : "",
        pickup_time_start: posOrderData.pickup_time_start || "",
        pickup_time_end: posOrderData.pickup_time_end || "",
        client_note: posOrderData.client_note || "",
        internal_note: posOrderData.internal_note || "",
        assigned_to_id: posOrderData.assigned_to?.id || "_none",
      })
    }
    setEditOpen(true)
  }

  const handleEditSubmit = () => {
    const updateData: Record<string, unknown> = {}

    if (formData.payment_status !== posOrderData?.payment_status) {
      updateData.payment_status = formData.payment_status
    }
    if (formData.pickup_date) {
      updateData.pickup_date = formData.pickup_date
    }
    if (formData.pickup_time_start !== posOrderData?.pickup_time_start) {
      updateData.pickup_time_start = formData.pickup_time_start || null
    }
    if (formData.pickup_time_end !== posOrderData?.pickup_time_end) {
      updateData.pickup_time_end = formData.pickup_time_end || null
    }
    if (formData.client_note !== posOrderData?.client_note) {
      updateData.client_note = formData.client_note || null
    }
    if (formData.internal_note !== posOrderData?.internal_note) {
      updateData.internal_note = formData.internal_note || null
    }
    if (formData.assigned_to_id !== (posOrderData?.assigned_to?.id || "_none")) {
      updateData.assigned_to_id = formData.assigned_to_id === "_none" ? null : formData.assigned_to_id
    }

    updatePosOrder.mutate(updateData as Partial<typeof formData>)
  }

  const handleCreateSubmit = () => {
    if (!createFormData.created_by_id) {
      toast.error("Veuillez sélectionner un employé")
      return
    }

    const assignedId = createFormData.assigned_to_id === "_none" || !createFormData.assigned_to_id
      ? undefined
      : createFormData.assigned_to_id

    createPosOrder.mutate({
      created_by_id: createFormData.created_by_id,
      assigned_to_id: assignedId,
      pickup_date: createFormData.pickup_date,
      pickup_time_start: createFormData.pickup_time_start,
      pickup_time_end: createFormData.pickup_time_end,
      client_note: createFormData.client_note,
      internal_note: createFormData.internal_note,
      order_id: order.id,
    })
  }

  // Loading state
  if (isLoading) {
    return (
      <Container className="p-4">
        <div className="flex items-center justify-center py-4">
          <Text className="text-ui-fg-subtle">Chargement...</Text>
        </div>
      </Container>
    )
  }

  // No POS order exists - show create button
  if (!posOrderData) {
    return (
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">POS</Heading>
          <Button size="small" onClick={() => setCreateOpen(true)}>
            <Plus />
            Créer commande POS
          </Button>
        </div>

        <div className="px-6 py-4">
          <Text className="text-ui-fg-subtle">
            Aucune commande POS associée à cette commande.
          </Text>
        </div>

        {/* Create Modal */}
        <FocusModal open={createOpen} onOpenChange={setCreateOpen}>
          <FocusModal.Content>
            <div className="flex h-full flex-col overflow-hidden">
              <FocusModal.Header>
                <div className="flex items-center justify-end gap-x-2">
                  <FocusModal.Close asChild>
                    <Button
                      size="small"
                      variant="secondary"
                      disabled={createPosOrder.isPending}
                    >
                      Annuler
                    </Button>
                  </FocusModal.Close>
                  <Button
                    size="small"
                    onClick={handleCreateSubmit}
                    isLoading={createPosOrder.isPending}
                  >
                    Créer
                  </Button>
                </div>
              </FocusModal.Header>

              <FocusModal.Body className="flex-1 overflow-auto p-6">
                <Heading level="h2" className="mb-6">
                  Nouvelle commande POS
                </Heading>
                <div className="flex flex-col gap-y-4">
                  <div className="flex flex-col gap-y-2">
                    <Label>Créé par *</Label>
                    <Select
                      value={createFormData.created_by_id}
                      onValueChange={(value) =>
                        setCreateFormData({ ...createFormData, created_by_id: value })
                      }
                    >
                      <Select.Trigger>
                        <Select.Value placeholder="Sélectionner un employé" />
                      </Select.Trigger>
                      <Select.Content>
                        {employeesData?.map((employee) => (
                          <Select.Item key={employee.id} value={employee.id}>
                            {employee.first_name} {employee.last_name}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-y-2">
                    <Label>Assigné à</Label>
                    <Select
                      value={createFormData.assigned_to_id}
                      onValueChange={(value) =>
                        setCreateFormData({ ...createFormData, assigned_to_id: value })
                      }
                    >
                      <Select.Trigger>
                        <Select.Value placeholder="Non assigné" />
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="_none">Non assigné</Select.Item>
                        {employeesData?.map((employee) => (
                          <Select.Item key={employee.id} value={employee.id}>
                            {employee.first_name} {employee.last_name}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-y-2">
                    <Label>Date de récupération</Label>
                    <Input
                      type="date"
                      value={createFormData.pickup_date}
                      onChange={(e) =>
                        setCreateFormData({ ...createFormData, pickup_date: e.target.value })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-y-2">
                      <Label>Heure début</Label>
                      <Input
                        type="time"
                        value={createFormData.pickup_time_start}
                        onChange={(e) =>
                          setCreateFormData({
                            ...createFormData,
                            pickup_time_start: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-y-2">
                      <Label>Heure fin</Label>
                      <Input
                        type="time"
                        value={createFormData.pickup_time_end}
                        onChange={(e) =>
                          setCreateFormData({
                            ...createFormData,
                            pickup_time_end: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-y-2">
                    <Label>Note client</Label>
                    <Textarea
                      value={createFormData.client_note}
                      onChange={(e) =>
                        setCreateFormData({ ...createFormData, client_note: e.target.value })
                      }
                      placeholder="Note visible pour le client"
                    />
                  </div>

                  <div className="flex flex-col gap-y-2">
                    <Label>Note interne</Label>
                    <Textarea
                      value={createFormData.internal_note}
                      onChange={(e) =>
                        setCreateFormData({ ...createFormData, internal_note: e.target.value })
                      }
                      placeholder="Note interne (non visible par le client)"
                    />
                  </div>
                </div>
              </FocusModal.Body>
            </div>
          </FocusModal.Content>
        </FocusModal>
      </Container>
    )
  }

  // POS order exists - show details
  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-x-3">
          <Heading level="h2">POS</Heading>
          <Text size="small" className="font-mono text-ui-fg-subtle">
            {posOrderData.ticket_number}
          </Text>
        </div>
        <Button size="small" variant="secondary" onClick={handleOpenEdit}>
          Modifier
        </Button>
      </div>

      {/* Quick status buttons */}
      <div className="px-6 py-4">
        <div className="mb-3">
          <Text size="small" weight="plus" className="text-ui-fg-subtle mb-2">
            Statut préparation
          </Text>
          <div className="flex flex-wrap gap-2">
            {PREPARATION_STATUS_OPTIONS.map((status) => (
              <Button
                key={status.value}
                size="small"
                variant={
                  posOrderData.preparation_status === status.value
                    ? "primary"
                    : "secondary"
                }
                onClick={() =>
                  updateStatus.mutate({ preparation_status: status.value })
                }
                disabled={updateStatus.isPending}
              >
                {status.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <Text size="small" weight="plus" className="text-ui-fg-subtle mb-2">
            Statut paiement
          </Text>
          <Badge color={PAYMENT_STATUS_COLORS[posOrderData.payment_status]}>
            {
              PAYMENT_STATUS_OPTIONS.find(
                (o) => o.value === posOrderData.payment_status
              )?.label
            }
          </Badge>
        </div>

        {/* Pickup time */}
        {posOrderData.pickup_date && (
          <div className="mb-3">
            <Text size="small" weight="plus" className="text-ui-fg-subtle">
              Récupération
            </Text>
            <Text size="small">
              {new Date(posOrderData.pickup_date).toLocaleDateString("fr-FR")}
              {posOrderData.pickup_time_start &&
                ` ${posOrderData.pickup_time_start}`}
              {posOrderData.pickup_time_end &&
                `-${posOrderData.pickup_time_end}`}
            </Text>
          </div>
        )}

        {/* Notes */}
        {posOrderData.client_note && (
          <div className="mb-3">
            <Text size="small" weight="plus" className="text-ui-fg-subtle">
              Note client
            </Text>
            <Text size="small">{posOrderData.client_note}</Text>
          </div>
        )}

        {posOrderData.internal_note && (
          <div className="mb-3">
            <Text size="small" weight="plus" className="text-ui-fg-subtle">
              Note interne
            </Text>
            <Text size="small">{posOrderData.internal_note}</Text>
          </div>
        )}

        {/* Assigned to */}
        {posOrderData.assigned_to && (
          <div>
            <Text size="small" weight="plus" className="text-ui-fg-subtle">
              Assigné à
            </Text>
            <Text size="small">
              {posOrderData.assigned_to.first_name}{" "}
              {posOrderData.assigned_to.last_name}
            </Text>
          </div>
        )}
      </div>

      {/* Edit Drawer */}
      <Drawer open={editOpen} onOpenChange={setEditOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Modifier commande POS</Drawer.Title>
          </Drawer.Header>

          <Drawer.Body className="flex-1 overflow-auto p-4">
            <div className="flex flex-col gap-y-4">
              <div className="flex flex-col gap-y-2">
                <Label>Statut paiement</Label>
                <Select
                  value={formData.payment_status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, payment_status: value })
                  }
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Sélectionner" />
                  </Select.Trigger>
                  <Select.Content>
                    {PAYMENT_STATUS_OPTIONS.map((option) => (
                      <Select.Item key={option.value} value={option.value}>
                        {option.label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>

              <div className="flex flex-col gap-y-2">
                <Label>Date de récupération</Label>
                <Input
                  type="date"
                  value={formData.pickup_date}
                  onChange={(e) =>
                    setFormData({ ...formData, pickup_date: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-y-2">
                  <Label>Heure début</Label>
                  <Input
                    type="time"
                    value={formData.pickup_time_start}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pickup_time_start: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label>Heure fin</Label>
                  <Input
                    type="time"
                    value={formData.pickup_time_end}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pickup_time_end: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col gap-y-2">
                <Label>Assigné à</Label>
                <Select
                  value={formData.assigned_to_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, assigned_to_id: value })
                  }
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Non assigné" />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="_none">Non assigné</Select.Item>
                    {employeesData?.map((employee) => (
                      <Select.Item key={employee.id} value={employee.id}>
                        {employee.first_name} {employee.last_name}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>

              <div className="flex flex-col gap-y-2">
                <Label>Note client</Label>
                <Textarea
                  value={formData.client_note}
                  onChange={(e) =>
                    setFormData({ ...formData, client_note: e.target.value })
                  }
                  placeholder="Note visible pour le client"
                />
              </div>

              <div className="flex flex-col gap-y-2">
                <Label>Note interne</Label>
                <Textarea
                  value={formData.internal_note}
                  onChange={(e) =>
                    setFormData({ ...formData, internal_note: e.target.value })
                  }
                  placeholder="Note interne (non visible par le client)"
                />
              </div>
            </div>
          </Drawer.Body>

          <Drawer.Footer>
            <div className="flex items-center justify-end gap-x-2">
              <Drawer.Close asChild>
                <Button
                  size="small"
                  variant="secondary"
                  disabled={updatePosOrder.isPending}
                >
                  Annuler
                </Button>
              </Drawer.Close>
              <Button
                size="small"
                onClick={handleEditSubmit}
                isLoading={updatePosOrder.isPending}
              >
                Enregistrer
              </Button>
            </div>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.before",
})

export default PosOrderDetailWidget
