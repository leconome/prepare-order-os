import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Button,
  Table,
  Text,
  Badge,
  FocusModal,
  Input,
  Label,
  Select,
  toast,
  Switch,
  IconButton,
  DropdownMenu,
} from "@medusajs/ui"
import { EllipsisHorizontal, PencilSquare, Trash, Plus } from "@medusajs/icons"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { sdk } from "../../../lib/client"

type Employee = {
  id: string
  first_name: string
  last_name: string
  pin: string
  role: "cashier" | "manager" | "kitchen"
  is_active: boolean
  created_at: string
}

const ROLE_LABELS = {
  cashier: "Caissier",
  manager: "Manager",
  kitchen: "Cuisine",
}

const ROLE_COLORS = {
  cashier: "blue" as const,
  manager: "purple" as const,
  kitchen: "orange" as const,
}

const EmployeesPage = () => {
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    pin: "",
    role: "cashier" as "cashier" | "manager" | "kitchen",
    is_active: true,
  })
  const queryClient = useQueryClient()

  // Fetch employees
  const { data, isLoading } = useQuery({
    queryFn: async () => {
      const response = await sdk.client.fetch<{
        employees: Employee[]
        count: number
      }>("/admin/pos/employees")
      return response
    },
    queryKey: ["pos-employees"],
  })

  // Create employee mutation
  const createEmployee = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await sdk.client.fetch<{ employee: Employee }>(
        "/admin/pos/employees",
        {
          method: "POST",
          body: data,
        }
      )
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos-employees"] })
      toast.success("Employé créé avec succès")
      setCreateOpen(false)
      resetForm()
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erreur lors de la création")
    },
  })

  // Update employee mutation
  const updateEmployee = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: Partial<typeof formData>
    }) => {
      const response = await sdk.client.fetch<{ employee: Employee }>(
        `/admin/pos/employees/${id}`,
        {
          method: "POST",
          body: data,
        }
      )
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos-employees"] })
      toast.success("Employé mis à jour")
      setEditOpen(false)
      setEditingEmployee(null)
      resetForm()
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erreur lors de la mise à jour")
    },
  })

  // Delete employee mutation
  const deleteEmployee = useMutation({
    mutationFn: async (id: string) => {
      await sdk.client.fetch(`/admin/pos/employees/${id}`, {
        method: "DELETE",
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos-employees"] })
      toast.success("Employé supprimé")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erreur lors de la suppression")
    },
  })

  const resetForm = () => {
    setFormData({
      first_name: "",
      last_name: "",
      pin: "",
      role: "cashier",
      is_active: true,
    })
  }

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee)
    setFormData({
      first_name: employee.first_name,
      last_name: employee.last_name,
      pin: employee.pin,
      role: employee.role,
      is_active: employee.is_active,
    })
    setEditOpen(true)
  }

  const handleCreateSubmit = () => {
    if (!formData.first_name || !formData.last_name || !formData.pin) {
      toast.error("Veuillez remplir tous les champs obligatoires")
      return
    }
    createEmployee.mutate(formData)
  }

  const handleEditSubmit = () => {
    if (!editingEmployee) return
    updateEmployee.mutate({ id: editingEmployee.id, data: formData })
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">Employés POS</Heading>
        <Button size="small" onClick={() => setCreateOpen(true)}>
          <Plus />
          Ajouter
        </Button>
      </div>

      <div className="px-6 py-4">
        {isLoading ? (
          <Text className="text-ui-fg-subtle">Chargement...</Text>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Nom</Table.HeaderCell>
                <Table.HeaderCell>Rôle</Table.HeaderCell>
                <Table.HeaderCell>PIN</Table.HeaderCell>
                <Table.HeaderCell>Statut</Table.HeaderCell>
                <Table.HeaderCell></Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {data?.employees.map((employee) => (
                <Table.Row key={employee.id}>
                  <Table.Cell>
                    <Text size="small" weight="plus">
                      {employee.first_name} {employee.last_name}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={ROLE_COLORS[employee.role]}>
                      {ROLE_LABELS[employee.role]}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small" className="font-mono">
                      ****
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={employee.is_active ? "green" : "grey"}>
                      {employee.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <DropdownMenu>
                      <DropdownMenu.Trigger asChild>
                        <IconButton size="small" variant="transparent">
                          <EllipsisHorizontal />
                        </IconButton>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Content>
                        <DropdownMenu.Item
                          className="gap-x-2"
                          onClick={() => handleEdit(employee)}
                        >
                          <PencilSquare className="text-ui-fg-subtle" />
                          Modifier
                        </DropdownMenu.Item>
                        <DropdownMenu.Separator />
                        <DropdownMenu.Item
                          className="gap-x-2"
                          onClick={() => {
                            if (
                              confirm(
                                `Supprimer ${employee.first_name} ${employee.last_name} ?`
                              )
                            ) {
                              deleteEmployee.mutate(employee.id)
                            }
                          }}
                        >
                          <Trash className="text-ui-fg-subtle" />
                          Supprimer
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
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
                    disabled={createEmployee.isPending}
                  >
                    Annuler
                  </Button>
                </FocusModal.Close>
                <Button
                  size="small"
                  onClick={handleCreateSubmit}
                  isLoading={createEmployee.isPending}
                >
                  Créer
                </Button>
              </div>
            </FocusModal.Header>

            <FocusModal.Body className="flex-1 overflow-auto p-6">
              <Heading level="h2" className="mb-6">
                Nouvel Employé
              </Heading>
              <div className="flex flex-col gap-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-y-2">
                    <Label>Prénom *</Label>
                    <Input
                      value={formData.first_name}
                      onChange={(e) =>
                        setFormData({ ...formData, first_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-y-2">
                    <Label>Nom *</Label>
                    <Input
                      value={formData.last_name}
                      onChange={(e) =>
                        setFormData({ ...formData, last_name: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-y-2">
                  <Label>PIN (4-6 chiffres) *</Label>
                  <Input
                    type="password"
                    maxLength={6}
                    value={formData.pin}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pin: e.target.value.replace(/\D/g, ""),
                      })
                    }
                  />
                </div>

                <div className="flex flex-col gap-y-2">
                  <Label>Rôle *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        role: value as "cashier" | "manager" | "kitchen",
                      })
                    }
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Sélectionner un rôle" />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="cashier">Caissier</Select.Item>
                      <Select.Item value="manager">Manager</Select.Item>
                      <Select.Item value="kitchen">Cuisine</Select.Item>
                    </Select.Content>
                  </Select>
                </div>

                <div className="flex items-center gap-x-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_active: checked })
                    }
                  />
                  <Label>Actif</Label>
                </div>
              </div>
            </FocusModal.Body>
          </div>
        </FocusModal.Content>
      </FocusModal>

      {/* Edit Modal */}
      <FocusModal open={editOpen} onOpenChange={setEditOpen}>
        <FocusModal.Content>
          <div className="flex h-full flex-col overflow-hidden">
            <FocusModal.Header>
              <div className="flex items-center justify-end gap-x-2">
                <FocusModal.Close asChild>
                  <Button
                    size="small"
                    variant="secondary"
                    disabled={updateEmployee.isPending}
                  >
                    Annuler
                  </Button>
                </FocusModal.Close>
                <Button
                  size="small"
                  onClick={handleEditSubmit}
                  isLoading={updateEmployee.isPending}
                >
                  Enregistrer
                </Button>
              </div>
            </FocusModal.Header>

            <FocusModal.Body className="flex-1 overflow-auto p-6">
              <Heading level="h2" className="mb-6">
                Modifier Employé
              </Heading>
              <div className="flex flex-col gap-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-y-2">
                    <Label>Prénom *</Label>
                    <Input
                      value={formData.first_name}
                      onChange={(e) =>
                        setFormData({ ...formData, first_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-y-2">
                    <Label>Nom *</Label>
                    <Input
                      value={formData.last_name}
                      onChange={(e) =>
                        setFormData({ ...formData, last_name: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-y-2">
                  <Label>PIN (4-6 chiffres)</Label>
                  <Input
                    type="password"
                    maxLength={6}
                    value={formData.pin}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pin: e.target.value.replace(/\D/g, ""),
                      })
                    }
                    placeholder="Laisser vide pour ne pas modifier"
                  />
                </div>

                <div className="flex flex-col gap-y-2">
                  <Label>Rôle *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        role: value as "cashier" | "manager" | "kitchen",
                      })
                    }
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Sélectionner un rôle" />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="cashier">Caissier</Select.Item>
                      <Select.Item value="manager">Manager</Select.Item>
                      <Select.Item value="kitchen">Cuisine</Select.Item>
                    </Select.Content>
                  </Select>
                </div>

                <div className="flex items-center gap-x-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_active: checked })
                    }
                  />
                  <Label>Actif</Label>
                </div>
              </div>
            </FocusModal.Body>
          </div>
        </FocusModal.Content>
      </FocusModal>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Employés POS",
})

export default EmployeesPage
