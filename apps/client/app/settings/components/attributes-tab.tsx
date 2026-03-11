"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createAttribute,
  createAttributeTerm,
  deleteAttribute,
  deleteAttributeTerm,
  fetchAttributes,
  updateAttribute,
  updateAttributeTerm,
} from "@/lib/api";

export function AttributesTab() {
  const queryClient = useQueryClient();
  const { data: attributes, isLoading } = useQuery({
    queryKey: ["attributes"],
    queryFn: fetchAttributes,
  });

  // New attribute form
  const [newAttrName, setNewAttrName] = useState("");
  const [showNewAttr, setShowNewAttr] = useState(false);

  // Editing attribute
  const [editingAttrId, setEditingAttrId] = useState<string | null>(null);
  const [editingAttrName, setEditingAttrName] = useState("");

  // New term form (per attribute)
  const [newTermAttrId, setNewTermAttrId] = useState<string | null>(null);
  const [newTermName, setNewTermName] = useState("");

  // Editing term
  const [editingTermId, setEditingTermId] = useState<string | null>(null);
  const [editingTermName, setEditingTermName] = useState("");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["attributes"] });

  const createAttrMutation = useMutation({
    mutationFn: (name: string) => createAttribute({ name }),
    onSuccess: () => {
      invalidate();
      setNewAttrName("");
      setShowNewAttr(false);
    },
  });

  const updateAttrMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      updateAttribute(id, { name }),
    onSuccess: () => {
      invalidate();
      setEditingAttrId(null);
    },
  });

  const deleteAttrMutation = useMutation({
    mutationFn: deleteAttribute,
    onSuccess: invalidate,
  });

  const createTermMutation = useMutation({
    mutationFn: ({
      attributeId,
      name,
    }: {
      attributeId: string;
      name: string;
    }) => createAttributeTerm(attributeId, { name }),
    onSuccess: () => {
      invalidate();
      setNewTermName("");
      setNewTermAttrId(null);
    },
  });

  const updateTermMutation = useMutation({
    mutationFn: ({
      attributeId,
      termId,
      name,
    }: {
      attributeId: string;
      termId: string;
      name: string;
    }) => updateAttributeTerm(attributeId, termId, { name }),
    onSuccess: () => {
      invalidate();
      setEditingTermId(null);
    },
  });

  const deleteTermMutation = useMutation({
    mutationFn: ({
      attributeId,
      termId,
    }: {
      attributeId: string;
      termId: string;
    }) => deleteAttributeTerm(attributeId, termId),
    onSuccess: invalidate,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tags className="h-5 w-5" />
              Attributs
            </CardTitle>
            <CardDescription>
              Definissez des attributs (Format, Couleur, Taille...) et leurs
              termes pour les variantes de produits.
            </CardDescription>
          </div>
          {!showNewAttr && (
            <Button
              size="sm"
              onClick={() => setShowNewAttr(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nouvel attribut
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* New attribute form */}
        {showNewAttr && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <Input
              placeholder="Nom de l'attribut (ex: Format, Couleur...)"
              value={newAttrName}
              onChange={(e) => setNewAttrName(e.target.value)}
              className="flex-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && newAttrName.trim()) {
                  createAttrMutation.mutate(newAttrName.trim());
                }
                if (e.key === "Escape") {
                  setShowNewAttr(false);
                  setNewAttrName("");
                }
              }}
            />
            <Button
              size="sm"
              disabled={!newAttrName.trim() || createAttrMutation.isPending}
              onClick={() => createAttrMutation.mutate(newAttrName.trim())}
            >
              {createAttrMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowNewAttr(false);
                setNewAttrName("");
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Attributes list */}
        {(!attributes || attributes.length === 0) && !showNewAttr && (
          <div className="py-8 text-center text-muted-foreground">
            Aucun attribut. Creez-en un pour commencer.
          </div>
        )}

        {attributes?.map((attr) => (
          <div
            key={attr.id}
            className="rounded-lg border bg-card"
          >
            {/* Attribute header */}
            <div className="flex items-center justify-between border-b px-4 py-3">
              {editingAttrId === attr.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={editingAttrName}
                    onChange={(e) => setEditingAttrName(e.target.value)}
                    className="h-8 max-w-xs"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && editingAttrName.trim()) {
                        updateAttrMutation.mutate({
                          id: attr.id,
                          name: editingAttrName.trim(),
                        });
                      }
                      if (e.key === "Escape") setEditingAttrId(null);
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={updateAttrMutation.isPending}
                    onClick={() =>
                      updateAttrMutation.mutate({
                        id: attr.id,
                        name: editingAttrName.trim(),
                      })
                    }
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => setEditingAttrId(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <h3 className="font-semibold text-sm">{attr.name}</h3>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => {
                        setEditingAttrId(attr.id);
                        setEditingAttrName(attr.name);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (
                          confirm(
                            `Supprimer l'attribut "${attr.name}" et tous ses termes ?`,
                          )
                        ) {
                          deleteAttrMutation.mutate(attr.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Terms list */}
            <div className="px-4 py-2 space-y-1">
              {attr.terms.map((term) => (
                <div
                  key={term.id}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50 group"
                >
                  {editingTermId === term.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editingTermName}
                        onChange={(e) => setEditingTermName(e.target.value)}
                        className="h-7 max-w-xs text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && editingTermName.trim()) {
                            updateTermMutation.mutate({
                              attributeId: attr.id,
                              termId: term.id,
                              name: editingTermName.trim(),
                            });
                          }
                          if (e.key === "Escape") setEditingTermId(null);
                        }}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() =>
                          updateTermMutation.mutate({
                            attributeId: attr.id,
                            termId: term.id,
                            name: editingTermName.trim(),
                          })
                        }
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => setEditingTermId(null)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm">{term.name}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => {
                            setEditingTermId(term.id);
                            setEditingTermName(term.name);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (
                              confirm(
                                `Supprimer le terme "${term.name}" ?`,
                              )
                            ) {
                              deleteTermMutation.mutate({
                                attributeId: attr.id,
                                termId: term.id,
                              });
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {/* Add term */}
              {newTermAttrId === attr.id ? (
                <div className="flex items-center gap-2 px-2 py-1">
                  <Input
                    placeholder="Nom du terme (ex: 250ml, Bleu...)"
                    value={newTermName}
                    onChange={(e) => setNewTermName(e.target.value)}
                    className="h-7 text-sm flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newTermName.trim()) {
                        createTermMutation.mutate({
                          attributeId: attr.id,
                          name: newTermName.trim(),
                        });
                      }
                      if (e.key === "Escape") {
                        setNewTermAttrId(null);
                        setNewTermName("");
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    disabled={
                      !newTermName.trim() || createTermMutation.isPending
                    }
                    onClick={() =>
                      createTermMutation.mutate({
                        attributeId: attr.id,
                        name: newTermName.trim(),
                      })
                    }
                  >
                    {createTermMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => {
                      setNewTermAttrId(null);
                      setNewTermName("");
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors w-full"
                  onClick={() => {
                    setNewTermAttrId(attr.id);
                    setNewTermName("");
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nouveau terme
                </button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
