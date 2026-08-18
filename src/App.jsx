import { useState, useEffect, useMemo } from "react";
import {
  Plus, Search, X, Pencil, Trash2, Tag as TagIcon,
  Calendar, Scale, CheckCircle2, Loader2,
  StickyNote, ShieldAlert, CircleDot, TrendingUp, TrendingDown, Settings2
} from "lucide-react";

const COLORS = {
  bg: "#26331F",       // pasture dusk green
  bgSoft: "#30412A",
  card: "#F4EDDA",     // manila / parchment tag
  cardEdge: "#E4D9B8",
  ink: "#2C2417",
  inkSoft: "#6B5F47",
  cream: "#F4EDDA",
  gold: "#C79A2C",     // tag yellow
  rust: "#B5482F",     // alert
  olive: "#6E7B3F",    // healthy
  clay: "#8A5A3B",
};

const STATUS = {
  "Saludable": { color: COLORS.olive, icon: CheckCircle2 },
  "Sobrepeso": { color: COLORS.gold, icon: TrendingUp },
  "Bajo peso": { color: COLORS.clay, icon: TrendingDown },
  "Enferma": { color: COLORS.rust, icon: ShieldAlert },
  "Vendida": { color: COLORS.inkSoft, icon: CircleDot },
};

const STORAGE_KEY = "herd-records";
const BREED_STORAGE_KEY = "breed-weight-ranges";

function uid() {
  return "cow-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

function ageFromDate(dateStr) {
  if (!dateStr) return null;
  const born = new Date(dateStr);
  if (isNaN(born.getTime())) return null;
  const now = new Date();
  let months = (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth());
  if (now.getDate() < born.getDate()) months -= 1;
  if (months < 0) return null;
  if (months < 12) return `${months} m`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem === 0 ? `${years} a` : `${years} a ${rem} m`;
}

const emptyForm = {
  tag: "", name: "", breed: "", sex: "Hembra",
  birthDate: "", weight: "", status: "Saludable", notes: "",
};

// Rangos de referencia (kg) por etapa y sexo, usados cuando la raza del
// animal no tiene un perfil personalizado guardado. Son valores generales
// de bovinos de doble propósito/cría en pastoreo.
const DEFAULT_WEIGHT_RANGES = {
  ternero: { Hembra: [90, 150], Macho: [100, 160] },   // 0-12 meses
  novillo: { Hembra: [150, 280], Macho: [160, 320] },  // 1-2 años
  adulto: { Hembra: [280, 450], Macho: [320, 550] },   // 2+ años
};

const STAGE_LABELS = { ternero: "Ternero/a (0–12 m)", novillo: "Novillo/a (1–2 a)", adulto: "Adulto/a (2+ a)" };

function normalizeBreedKey(breed) {
  return (breed || "").trim().toLowerCase();
}

function ageCategory(birthDateStr) {
  if (!birthDateStr) return "adulto"; // sin fecha, se asume adulto
  const born = new Date(birthDateStr);
  if (isNaN(born.getTime())) return "adulto";
  const now = new Date();
  let months = (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth());
  if (now.getDate() < born.getDate()) months -= 1;
  if (months < 12) return "ternero";
  if (months < 24) return "novillo";
  return "adulto";
}

// Devuelve los rangos a usar para una raza: el perfil personalizado si
// existe (comparación sin distinguir mayúsculas/espacios), o el default.
function getRangesForBreed(breed, breedRanges) {
  const key = normalizeBreedKey(breed);
  if (key && breedRanges && breedRanges[key]) return breedRanges[key];
  return DEFAULT_WEIGHT_RANGES;
}

function classifyWeight(weight, birthDateStr, sex, breed, breedRanges) {
  if (weight == null || weight === "" || isNaN(Number(weight))) return null;
  const num = Number(weight);
  const category = ageCategory(birthDateStr);
  const ranges = getRangesForBreed(breed, breedRanges);
  const [min, max] = ranges[category][sex] || ranges[category]["Hembra"];
  if (num < min) return "Bajo peso";
  if (num > max) return "Sobrepeso";
  return "Saludable";
}

// Aplica la clasificación automática al formulario, salvo que el animal
// esté marcado manualmente como Enferma o Vendida (esos estados no se pisan).
function withAutoStatus(nextForm, breedRanges) {
  if (nextForm.status === "Enferma" || nextForm.status === "Vendida") return nextForm;
  const classified = classifyWeight(nextForm.weight, nextForm.birthDate, nextForm.sex, nextForm.breed, breedRanges);
  if (!classified) return nextForm;
  return { ...nextForm, status: classified };
}

// Recalcula el estado de peso de todo el hato con los rangos vigentes.
// Se usa cada vez que se crea/edita/borra un perfil de raza, para que el
// cambio se aplique a todos los animales de esa raza automáticamente.
function recomputeHerdStatuses(herd, breedRanges) {
  return herd.map((cow) => {
    if (cow.status === "Enferma" || cow.status === "Vendida") return cow;
    const classified = classifyWeight(cow.weight, cow.birthDate, cow.sex, cow.breed, breedRanges);
    if (!classified || classified === cow.status) return cow;
    return { ...cow, status: classified };
  });
}

export default function App() {
  const [herd, setHerd] = useState([]);
  const [breedRanges, setBreedRanges] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});

  const [confirmId, setConfirmId] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [breedModalOpen, setBreedModalOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setHerd(Array.isArray(parsed) ? parsed : []);
      }
    } catch (e) {
      setHerd([]);
    }
    try {
      const rawRanges = localStorage.getItem(BREED_STORAGE_KEY);
      if (rawRanges) {
        const parsedRanges = JSON.parse(rawRanges);
        setBreedRanges(parsedRanges && typeof parsedRanges === "object" ? parsedRanges : {});
      }
    } catch (e) {
      setBreedRanges({});
    } finally {
      setLoading(false);
    }
  }, []);

  function persist(nextHerd) {
    setHerd(nextHerd);
    setSaving(true);
    setSaveError(false);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextHerd));
    } catch (e) {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  // Guarda los perfiles de raza y aplica de inmediato los nuevos rangos a
  // todo el hato (recalcula Saludable/Sobrepeso/Bajo peso de cada animal).
  function saveBreedRanges(nextRanges) {
    setBreedRanges(nextRanges);
    try {
      localStorage.setItem(BREED_STORAGE_KEY, JSON.stringify(nextRanges));
    } catch (e) {
      setSaveError(true);
    }
    const recomputed = recomputeHerdStatuses(herd, nextRanges);
    persist(recomputed);
  }

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setFormErrors({});
    setModalOpen(true);
  }

  function openEdit(cow) {
    setEditingId(cow.id);
    setForm({
      tag: cow.tag || "", name: cow.name || "", breed: cow.breed || "",
      sex: cow.sex || "Hembra", birthDate: cow.birthDate || "",
      weight: cow.weight != null ? String(cow.weight) : "",
      status: cow.status || "Saludable", notes: cow.notes || "",
    });
    setFormErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
  }

  function validate() {
    const errs = {};
    if (!form.tag.trim()) errs.tag = "El número de arete es obligatorio";
    if (form.weight && isNaN(Number(form.weight))) errs.weight = "Debe ser un número";
    return errs;
  }

  function submitForm(e) {
    e.preventDefault();
    const errs = validate();
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const record = {
      id: editingId || uid(),
      tag: form.tag.trim(),
      name: form.name.trim(),
      breed: form.breed.trim(),
      sex: form.sex,
      birthDate: form.birthDate,
      weight: form.weight ? Number(form.weight) : null,
      status: form.status,
      notes: form.notes.trim(),
      createdAt: editingId
        ? (herd.find((c) => c.id === editingId)?.createdAt || Date.now())
        : Date.now(),
    };

    const next = editingId
      ? herd.map((c) => (c.id === editingId ? record : c))
      : [record, ...herd];

    persist(next);
    closeModal();
  }

  function confirmDelete(id) {
    const next = herd.filter((c) => c.id !== id);
    persist(next);
    setConfirmId(null);
  }

  const filtered = useMemo(() => {
    return herd.filter((c) => {
      const matchesQuery =
        !query.trim() ||
        c.tag.toLowerCase().includes(query.toLowerCase()) ||
        c.name.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = statusFilter === "Todos" || c.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [herd, query, statusFilter]);

  const stats = useMemo(() => {
    const total = herd.length;
    const healthy = herd.filter((c) => c.status === "Saludable").length;
    const attention = herd.filter((c) =>
      c.status === "Enferma" || c.status === "Sobrepeso" || c.status === "Bajo peso"
    ).length;
    const weights = herd.filter((c) => typeof c.weight === "number" && c.status !== "Vendida").map((c) => c.weight);
    const avgWeight = weights.length ? Math.round(weights.reduce((a, b) => a + b, 0) / weights.length) : null;
    return { total, healthy, attention, avgWeight };
  }, [herd]);

  return (
    <div
      className="min-h-full w-full"
      style={{ background: COLORS.bg, fontFamily: "'Inter', sans-serif", color: COLORS.cream }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap');
        .mg-display { font-family: 'Space Grotesk', sans-serif; }
        .mg-mono { font-family: 'JetBrains Mono', monospace; }
        .mg-hole {
          box-shadow: inset 0 0 0 2px var(--hole-ring);
        }
        .mg-card { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .mg-card:hover { transform: translateY(-2px); }
        .mg-fade-in { animation: mgFadeIn 0.25s ease both; }
        @keyframes mgFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .mg-select { -webkit-appearance: none; appearance: none; }
        ::selection { background: ${COLORS.gold}; color: ${COLORS.ink}; }
      `}</style>

      {/* Header */}
      <header className="px-4 sm:px-8 pt-8 pb-6" style={{ background: COLORS.bgSoft }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <svg width="38" height="38" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="19" stroke={COLORS.gold} strokeWidth="2" />
              <path d="M12 16c1-3 4-5 8-5s7 2 8 5" stroke={COLORS.gold} strokeWidth="2" strokeLinecap="round" />
              <path d="M13 16c-2 0-4 1.5-4 4s2 3 3 2" stroke={COLORS.gold} strokeWidth="2" strokeLinecap="round" />
              <path d="M27 16c2 0 4 1.5 4 4s-2 3-3 2" stroke={COLORS.gold} strokeWidth="2" strokeLinecap="round" />
              <ellipse cx="20" cy="23" rx="7" ry="6" stroke={COLORS.gold} strokeWidth="2" />
              <circle cx="17.5" cy="22.5" r="1.2" fill={COLORS.gold} />
              <circle cx="22.5" cy="22.5" r="1.2" fill={COLORS.gold} />
            </svg>
            <div>
              <h1 className="mg-display text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: COLORS.cream }}>
                Mi Registro
              </h1>
              <p className="text-xs sm:text-sm" style={{ color: "#B9C2A8" }}>
                Registro del hato · {stats.total} {stats.total === 1 ? "animal" : "animales"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setBreedModalOpen(true)}
              className="flex items-center gap-2 rounded-full px-3 py-2.5 sm:px-4 sm:py-3 font-semibold text-sm"
              style={{ background: "rgba(244,237,218,0.1)", color: COLORS.cream }}
              title="Configurar rangos de peso por raza"
            >
              <Settings2 size={18} />
              <span className="hidden sm:inline">Razas</span>
            </button>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 rounded-full px-4 py-2.5 sm:px-5 sm:py-3 font-semibold text-sm"
              style={{ background: COLORS.gold, color: COLORS.ink }}
            >
              <Plus size={18} strokeWidth={2.5} />
              <span className="hidden sm:inline">Agregar animal</span>
              <span className="sm:hidden">Agregar</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          {[
            { label: "Total", value: stats.total, color: COLORS.cream },
            { label: "Saludables", value: stats.healthy, color: COLORS.olive },
            { label: "Requieren atención", value: stats.attention, color: COLORS.rust },
            { label: "Peso promedio", value: stats.avgWeight ? `${stats.avgWeight} kg` : "—", color: COLORS.gold },
          ].map((s) => (
            <div key={s.label} className="rounded-xl px-3 py-3" style={{ background: "rgba(244,237,218,0.06)" }}>
              <div className="mg-mono text-xl sm:text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[11px] sm:text-xs mt-0.5" style={{ color: "#9CA687" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </header>

      {/* Controls */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8 mt-6 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 rounded-full px-4 py-2 flex-1 min-w-[200px]" style={{ background: COLORS.bgSoft }}>
          <Search size={16} color="#9CA687" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por arete o nombre..."
            className="bg-transparent outline-none text-sm w-full"
            style={{ color: COLORS.cream }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="mg-select rounded-full px-4 py-2 text-sm outline-none"
          style={{ background: COLORS.bgSoft, color: COLORS.cream, border: "none" }}
        >
          <option value="Todos">Todos los estados</option>
          {Object.keys(STATUS).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {saving && (
          <span className="text-xs flex items-center gap-1" style={{ color: "#9CA687" }}>
            <Loader2 size={12} className="animate-spin" /> Guardando...
          </span>
        )}
        {saveError && (
          <span className="text-xs" style={{ color: COLORS.rust }}>
            No se pudo guardar. Intenta de nuevo.
          </span>
        )}
      </div>

      {/* Body */}
      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-24" style={{ color: "#9CA687" }}>
            <Loader2 className="animate-spin mr-2" size={18} /> Cargando el hato...
          </div>
        ) : herd.length === 0 ? (
          <EmptyState onAdd={openAdd} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20" style={{ color: "#9CA687" }}>
            Ningún animal coincide con la búsqueda.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((cow) => (
              <CowCard
                key={cow.id}
                cow={cow}
                onEdit={() => openEdit(cow)}
                onDeleteRequest={() => setConfirmId(cow.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Add/Edit modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: "rgba(20,24,15,0.65)" }}
          onClick={closeModal}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitForm}
            className="mg-fade-in w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-6 max-h-[92vh] overflow-y-auto"
            style={{ background: COLORS.card, color: COLORS.ink }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="mg-display text-xl font-bold">
                {editingId ? "Editar animal" : "Nuevo animal"}
              </h2>
              <button type="button" onClick={closeModal} className="p-1 rounded-full" style={{ color: COLORS.inkSoft }}>
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Número de arete *" error={formErrors.tag}>
                <input
                  value={form.tag}
                  onChange={(e) => setForm({ ...form, tag: e.target.value })}
                  className="mg-mono"
                  style={inputStyle}
                  placeholder="Ej. 0231"
                />
              </Field>
              <Field label="Nombre">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  style={inputStyle}
                  placeholder="Ej. Canela"
                />
              </Field>
              <Field label="Raza">
                <input
                  value={form.breed}
                  onChange={(e) => setForm(withAutoStatus({ ...form, breed: e.target.value }, breedRanges))}
                  style={inputStyle}
                  placeholder="Ej. Brahman"
                  list="mg-breed-list"
                />
                {Object.keys(breedRanges).length > 0 && (
                  <datalist id="mg-breed-list">
                    {Object.values(breedRanges).map((b) => <option key={b.name} value={b.name} />)}
                  </datalist>
                )}
              </Field>
              <Field label="Sexo">
                <select
                  value={form.sex}
                  onChange={(e) => setForm(withAutoStatus({ ...form, sex: e.target.value }, breedRanges))}
                  className="mg-select"
                  style={inputStyle}
                >
                  <option>Hembra</option>
                  <option>Macho</option>
                </select>
              </Field>
              <Field label="Fecha de nacimiento">
                <input
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => setForm(withAutoStatus({ ...form, birthDate: e.target.value }, breedRanges))}
                  style={inputStyle}
                />
              </Field>
              <Field label="Peso (kg)" error={formErrors.weight}>
                <input
                  value={form.weight}
                  onChange={(e) => setForm(withAutoStatus({ ...form, weight: e.target.value }, breedRanges))}
                  className="mg-mono"
                  style={inputStyle}
                  placeholder="Ej. 380"
                  inputMode="decimal"
                />
              </Field>
              <div className="col-span-2">
                <Field label="Estado de salud">
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="mg-select"
                    style={inputStyle}
                  >
                    {Object.keys(STATUS).map((s) => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <p className="text-[11px] mt-1.5" style={{ color: COLORS.inkSoft }}>
                  Saludable / Sobrepeso / Bajo peso se calculan según el peso, la edad, el sexo y los{" "}
                  <button
                    type="button"
                    onClick={() => setBreedModalOpen(true)}
                    className="underline font-semibold"
                    style={{ color: COLORS.clay }}
                  >
                    rangos configurados para la raza
                  </button>. Puedes cambiarlo a Enferma o Vendida manualmente cuando lo necesites.
                </p>
              </div>
              <div className="col-span-2">
                <Field label="Notas">
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
                    placeholder="Observaciones, vacunas, tratamientos..."
                  />
                </Field>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 rounded-full py-3 font-semibold text-sm"
                style={{ background: "transparent", border: `1.5px solid ${COLORS.inkSoft}`, color: COLORS.inkSoft }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 rounded-full py-3 font-semibold text-sm"
                style={{ background: COLORS.olive, color: COLORS.cream }}
              >
                {editingId ? "Guardar cambios" : "Agregar animal"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete confirm */}
      {confirmId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(20,24,15,0.65)" }}
          onClick={() => setConfirmId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="mg-fade-in w-full max-w-sm rounded-2xl p-6"
            style={{ background: COLORS.card, color: COLORS.ink }}
          >
            <h3 className="mg-display text-lg font-bold mb-2">¿Eliminar este animal?</h3>
            <p className="text-sm mb-5" style={{ color: COLORS.inkSoft }}>
              Esta acción no se puede deshacer. El registro se borrará de tu inventario.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmId(null)}
                className="flex-1 rounded-full py-2.5 font-semibold text-sm"
                style={{ background: "transparent", border: `1.5px solid ${COLORS.inkSoft}`, color: COLORS.inkSoft }}
              >
                Cancelar
              </button>
              <button
                onClick={() => confirmDelete(confirmId)}
                className="flex-1 rounded-full py-2.5 font-semibold text-sm"
                style={{ background: COLORS.rust, color: COLORS.cream }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Breed weight-range settings */}
      {breedModalOpen && (
        <BreedRangesModal
          breedRanges={breedRanges}
          onSave={saveBreedRanges}
          onClose={() => setBreedModalOpen(false)}
        />
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  background: "#FFFDF7",
  border: `1.5px solid ${COLORS.cardEdge}`,
  borderRadius: 10,
  padding: "9px 12px",
  fontSize: 14,
  color: COLORS.ink,
  outline: "none",
};

function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium block mb-1" style={{ color: COLORS.inkSoft }}>{label}</span>
      {children}
      {error && <span className="text-xs block mt-1" style={{ color: COLORS.rust }}>{error}</span>}
    </label>
  );
}

function CowCard({ cow, onEdit, onDeleteRequest }) {
  const statusInfo = STATUS[cow.status] || STATUS["Saludable"];
  const StatusIcon = statusInfo.icon;
  const age = ageFromDate(cow.birthDate);

  return (
    <div
      className="mg-card mg-fade-in relative rounded-r-2xl rounded-l-lg pl-6 pr-4 py-4 shadow-lg"
      style={{ background: COLORS.card, borderLeft: `7px solid ${statusInfo.color}` }}
    >
      {/* punch hole */}
      <div
        className="absolute rounded-full"
        style={{
          left: -8, top: 18, width: 14, height: 14,
          background: COLORS.bg,
          boxShadow: `inset 0 0 0 2.5px ${statusInfo.color}`,
        }}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="mg-mono text-2xl font-bold leading-none" style={{ color: COLORS.ink }}>
            #{cow.tag}
          </div>
          {cow.name && (
            <div className="text-sm font-semibold mt-1 truncate" style={{ color: COLORS.inkSoft }}>
              {cow.name}
            </div>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={onEdit} className="p-1.5 rounded-full" style={{ color: COLORS.inkSoft, background: "rgba(0,0,0,0.04)" }}>
            <Pencil size={14} />
          </button>
          <button onClick={onDeleteRequest} className="p-1.5 rounded-full" style={{ color: COLORS.rust, background: "rgba(0,0,0,0.04)" }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div
        className="flex items-center gap-1.5 mt-3 text-xs font-semibold rounded-full px-2.5 py-1 w-fit"
        style={{ background: `${statusInfo.color}22`, color: statusInfo.color }}
      >
        <StatusIcon size={12} />
        {cow.status}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3 text-xs" style={{ color: COLORS.inkSoft }}>
        {cow.breed && (
          <div className="flex items-center gap-1.5">
            <TagIcon size={12} /> {cow.breed}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <CircleDot size={12} /> {cow.sex}
        </div>
        {cow.weight != null && (
          <div className="flex items-center gap-1.5">
            <Scale size={12} /> {cow.weight} kg
          </div>
        )}
        {age && (
          <div className="flex items-center gap-1.5">
            <Calendar size={12} /> {age}
          </div>
        )}
      </div>

      {cow.notes && (
        <div className="flex items-start gap-1.5 mt-3 pt-3 text-xs" style={{ color: COLORS.inkSoft, borderTop: `1px solid ${COLORS.cardEdge}` }}>
          <StickyNote size={12} className="mt-0.5 shrink-0" />
          <span className="line-clamp-2">{cow.notes}</span>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center text-center py-20 px-4">
      <svg width="56" height="56" viewBox="0 0 40 40" fill="none" className="mb-4 opacity-70">
        <circle cx="20" cy="20" r="19" stroke={COLORS.gold} strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M12 16c1-3 4-5 8-5s7 2 8 5" stroke={COLORS.gold} strokeWidth="1.5" strokeLinecap="round" />
        <ellipse cx="20" cy="23" rx="7" ry="6" stroke={COLORS.gold} strokeWidth="1.5" />
      </svg>
      <h3 className="mg-display text-lg font-bold" style={{ color: COLORS.cream }}>
        Todavía no hay animales registrados
      </h3>
      <p className="text-sm mt-1.5 max-w-xs" style={{ color: "#9CA687" }}>
        Agrega tu primer animal para empezar a llevar el control de tu hato.
      </p>
      <button
        onClick={onAdd}
        className="mt-5 flex items-center gap-2 rounded-full px-5 py-2.5 font-semibold text-sm"
        style={{ background: COLORS.gold, color: COLORS.ink }}
      >
        <Plus size={16} strokeWidth={2.5} /> Agregar primer animal
      </button>
    </div>
  );
}

function emptyBreedForm(seed) {
  const base = seed || DEFAULT_WEIGHT_RANGES;
  return {
    name: seed && seed.name ? seed.name : "",
    ternero: { Hembra: [...base.ternero.Hembra], Macho: [...base.ternero.Macho] },
    novillo: { Hembra: [...base.novillo.Hembra], Macho: [...base.novillo.Macho] },
    adulto: { Hembra: [...base.adulto.Hembra], Macho: [...base.adulto.Macho] },
  };
}

function BreedRangesModal({ breedRanges, onSave, onClose }) {
  const [view, setView] = useState("list"); // "list" | "form"
  const [editingKey, setEditingKey] = useState(null);
  const [form, setForm] = useState(emptyBreedForm());
  const [error, setError] = useState("");

  const profiles = Object.entries(breedRanges).sort((a, b) => a[1].name.localeCompare(b[1].name));

  function openNew() {
    setEditingKey(null);
    setForm(emptyBreedForm());
    setError("");
    setView("form");
  }

  function openEdit(key) {
    setEditingKey(key);
    setForm(emptyBreedForm(breedRanges[key]));
    setError("");
    setView("form");
  }

  function updateRange(stage, sex, index, value) {
    setForm((prev) => {
      const next = { ...prev, [stage]: { ...prev[stage], [sex]: [...prev[stage][sex]] } };
      next[stage][sex][index] = value;
      return next;
    });
  }

  function handleDelete(key) {
    const next = { ...breedRanges };
    delete next[key];
    onSave(next);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setError("Ponle un nombre a la raza");
      return;
    }
    const key = normalizeBreedKey(name);
    if (!editingKey || editingKey !== key) {
      if (breedRanges[key]) {
        setError("Ya existe un perfil con ese nombre de raza");
        return;
      }
    }
    for (const stage of ["ternero", "novillo", "adulto"]) {
      for (const sex of ["Hembra", "Macho"]) {
        const [min, max] = form[stage][sex];
        if (min === "" || max === "" || isNaN(Number(min)) || isNaN(Number(max))) {
          setError("Todos los rangos deben ser números");
          return;
        }
        if (Number(min) >= Number(max)) {
          setError("En cada rango, el mínimo debe ser menor que el máximo");
          return;
        }
      }
    }

    const cleaned = {
      name,
      ternero: {
        Hembra: [Number(form.ternero.Hembra[0]), Number(form.ternero.Hembra[1])],
        Macho: [Number(form.ternero.Macho[0]), Number(form.ternero.Macho[1])],
      },
      novillo: {
        Hembra: [Number(form.novillo.Hembra[0]), Number(form.novillo.Hembra[1])],
        Macho: [Number(form.novillo.Macho[0]), Number(form.novillo.Macho[1])],
      },
      adulto: {
        Hembra: [Number(form.adulto.Hembra[0]), Number(form.adulto.Hembra[1])],
        Macho: [Number(form.adulto.Macho[0]), Number(form.adulto.Macho[1])],
      },
    };

    const next = { ...breedRanges };
    if (editingKey && editingKey !== key) delete next[editingKey];
    next[key] = cleaned;

    onSave(next);
    setView("list");
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(20,24,15,0.7)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mg-fade-in w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl p-6 max-h-[92vh] overflow-y-auto"
        style={{ background: COLORS.card, color: COLORS.ink }}
      >
        {view === "list" ? (
          <>
            <div className="flex items-center justify-between mb-1">
              <h2 className="mg-display text-xl font-bold">Rangos de peso por raza</h2>
              <button type="button" onClick={onClose} className="p-1 rounded-full" style={{ color: COLORS.inkSoft }}>
                <X size={20} />
              </button>
            </div>
            <p className="text-xs mb-4" style={{ color: COLORS.inkSoft }}>
              Define para cada raza los rangos de peso normal por etapa y sexo. Al guardar, se recalcula
              automáticamente el estado de todos los animales de esa raza. Las razas sin perfil usan un
              rango general de referencia.
            </p>

            {profiles.length === 0 ? (
              <div className="text-sm text-center py-8" style={{ color: COLORS.inkSoft }}>
                Aún no has configurado ninguna raza. Se está usando el rango general para todos los animales.
              </div>
            ) : (
              <div className="flex flex-col gap-2 mb-4">
                {profiles.map(([key, profile]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-xl px-3 py-2.5"
                    style={{ background: "#FFFDF7", border: `1.5px solid ${COLORS.cardEdge}` }}
                  >
                    <div>
                      <div className="text-sm font-semibold">{profile.name}</div>
                      <div className="mg-mono text-[11px]" style={{ color: COLORS.inkSoft }}>
                        Adulta: {profile.adulto.Hembra[0]}–{profile.adulto.Hembra[1]} kg · Adulto: {profile.adulto.Macho[0]}–{profile.adulto.Macho[1]} kg
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEdit(key)} className="p-1.5 rounded-full" style={{ color: COLORS.inkSoft, background: "rgba(0,0,0,0.04)" }}>
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(key)} className="p-1.5 rounded-full" style={{ color: COLORS.rust, background: "rgba(0,0,0,0.04)" }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={openNew}
              className="w-full flex items-center justify-center gap-2 rounded-full py-2.5 font-semibold text-sm"
              style={{ background: COLORS.olive, color: COLORS.cream }}
            >
              <Plus size={16} strokeWidth={2.5} /> Agregar raza
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="mg-display text-xl font-bold">
                {editingKey ? "Editar raza" : "Nueva raza"}
              </h2>
              <button type="button" onClick={onClose} className="p-1 rounded-full" style={{ color: COLORS.inkSoft }}>
                <X size={20} />
              </button>
            </div>

            <Field label="Nombre de la raza">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                style={inputStyle}
                placeholder="Ej. Brahman"
              />
            </Field>

            <div className="mt-4 flex flex-col gap-3">
              {["ternero", "novillo", "adulto"].map((stage) => (
                <div key={stage} className="rounded-xl p-3" style={{ background: "#FFFDF7", border: `1.5px solid ${COLORS.cardEdge}` }}>
                  <div className="text-xs font-semibold mb-2" style={{ color: COLORS.inkSoft }}>{STAGE_LABELS[stage]}</div>
                  <div className="grid grid-cols-2 gap-3">
                    {["Hembra", "Macho"].map((sex) => (
                      <div key={sex}>
                        <div className="text-[11px] font-medium mb-1" style={{ color: COLORS.inkSoft }}>{sex} (kg)</div>
                        <div className="flex items-center gap-1.5">
                          <input
                            value={form[stage][sex][0]}
                            onChange={(e) => updateRange(stage, sex, 0, e.target.value)}
                            className="mg-mono"
                            style={{ ...inputStyle, padding: "7px 8px", fontSize: 13 }}
                            placeholder="mín"
                            inputMode="decimal"
                          />
                          <span style={{ color: COLORS.inkSoft }}>–</span>
                          <input
                            value={form[stage][sex][1]}
                            onChange={(e) => updateRange(stage, sex, 1, e.target.value)}
                            className="mg-mono"
                            style={{ ...inputStyle, padding: "7px 8px", fontSize: 13 }}
                            placeholder="máx"
                            inputMode="decimal"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {error && <p className="text-xs mt-3" style={{ color: COLORS.rust }}>{error}</p>}

            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => setView("list")}
                className="flex-1 rounded-full py-3 font-semibold text-sm"
                style={{ background: "transparent", border: `1.5px solid ${COLORS.inkSoft}`, color: COLORS.inkSoft }}
              >
                Atrás
              </button>
              <button
                type="submit"
                className="flex-1 rounded-full py-3 font-semibold text-sm"
                style={{ background: COLORS.olive, color: COLORS.cream }}
              >
                Guardar raza
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
