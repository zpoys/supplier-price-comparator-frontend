import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Container,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  Heading,
  HStack,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  PopoverArrow,
  Skeleton,
  SkeletonText,
  Spacer,
  Stack,
  Text,
  VStack,
  useColorMode,
  useDisclosure,
  useToast,
  Tooltip,
  SimpleGrid,
  Progress,
} from "@chakra-ui/react";
import {
  Activity,
  Building2,
  Boxes,
  Clock3,
  Database,
  Eye,
  LayoutDashboard,
  LogOut,
  Moon,
  Package,
  Plus,
  Pencil,
  RefreshCw,
  Search,
  Sun,
  Tags,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import {
  clearAllCache,
  clearCacheByPrefix,
  post,
  queryString,
  request,
} from "./api";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./auth";
import * as XLSX from "xlsx";
type Row = Record<string, any>;
type Key =
  | "dashboard"
  | "target-types"
  | "providers"
  | "products"
  | "suppliers"
  | "product-suppliers";
type Field = {
  name: string;
  label: string;
  required?: boolean;
  fk?: string;
  url?: boolean;
};
const NAV: { key: Key; label: string; icon: any; group: string }[] = [
  {
    key: "dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    group: "WORKSPACE",
  },
  {
    key: "target-types",
    label: "Target types",
    icon: Tags,
    group: "MASTER DATA",
  },
  {
    key: "providers",
    label: "Providers",
    icon: Building2,
    group: "MASTER DATA",
  },
  { key: "products", label: "Products", icon: Package, group: "MASTER DATA" },
  { key: "suppliers", label: "Suppliers", icon: Truck, group: "MASTER DATA" },
  {
    key: "product-suppliers",
    label: "Product suppliers",
    icon: Boxes,
    group: "MAPPING",
  },
];
const CFG: Record<
  Exclude<Key, "dashboard">,
  {
    title: string;
    endpoint: string;
    fields: Field[];
    search: string[];
    fk?: { key: string; endpoint: string; label: string };
    crud: boolean;
  }
> = {
  "target-types": {
    title: "Target types",
    endpoint: "target-types",
    fields: [
      { name: "code", label: "Code", required: true },
      { name: "name", label: "Name", required: true },
    ],
    search: ["code", "name"],
    crud: false,
  },
  providers: {
    title: "Providers",
    endpoint: "providers",
    fields: [
      { name: "code", label: "Code", required: true },
      { name: "name", label: "Name", required: true },
    ],
    search: ["code", "name"],
    crud: true,
  },
  products: {
    title: "Products",
    endpoint: "products",
    fields: [
      { name: "code", label: "Code", required: true },
      {
        name: "providerCode",
        label: "Provider",
        required: true,
        fk: "providers",
      },
      { name: "name", label: "Name", required: true },
    ],
    search: ["code", "name", "providerCode"],
    fk: { key: "providerCode", endpoint: "providers", label: "Provider" },
    crud: true,
  },
  suppliers: {
    title: "Suppliers",
    endpoint: "suppliers",
    fields: [
      { name: "code", label: "Code", required: true },
      {
        name: "targetTypeCode",
        label: "Target type",
        required: true,
        fk: "target-types",
      },
      { name: "name", label: "Name", required: true },
      {
        name: "productListUrl",
        label: "Product list URL",
        required: true,
        url: true,
      },
    ],
    search: ["code", "name", "targetTypeCode"],
    fk: {
      key: "targetTypeCode",
      endpoint: "target-types",
      label: "Target type",
    },
    crud: true,
  },
  "product-suppliers": {
    title: "Product suppliers",
    endpoint: "product-suppliers",
    fields: [
      { name: "productCode", label: "Product", required: true, fk: "products" },
      {
        name: "supplierCode",
        label: "Supplier",
        required: true,
        fk: "suppliers",
      },
      {
        name: "supplierProductCode",
        label: "Supplier product code",
        required: true,
      },
    ],
    search: ["supplierCode"],
    fk: { key: "supplierCode", endpoint: "suppliers", label: "Supplier" },
    crud: true,
  },
};
function parseSupplierProductCode(input?: string) {
  if (input) {
    return input.match(/(?:product|kodeproduk)=([^&]+)/)?.[1] || "UNKNOWN";
  }
  return undefined;
}

const title = (s: string) =>
  s.replace(/([A-Z])/g, " $1").replace(/^./, (x) => x.toUpperCase());
const date = (v: any) =>
  v
    ? new Date(v).toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
const money = (v: any) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(v || 0));
const validCode = (s: string) => /^[A-Z][A-Z0-9_]{0,15}$/.test(s);

function RelationCombobox({
  value,
  options,
  placeholder,
  onChange,
  isDisabled = false,
  allowEmpty = false,
}: {
  value: string;
  options: Row[];
  placeholder: string;
  onChange: (value: string) => void;
  isDisabled?: boolean;
  allowEmpty?: boolean;
}) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const selected = useMemo(
    () => options.find((option) => option.code === value),
    [options, value],
  );
  const filtered = useMemo(
    () =>
      options.filter((option) =>
        `${option.code} ${option.name}`
          .toLowerCase()
          .includes(normalizedSearch),
      ),
    [options, normalizedSearch],
  );

  return (
    <Popover placement="bottom-start" isLazy matchWidth>
      {({ onClose }) => (
        <>
          <PopoverTrigger>
            <Button
              width="100%"
              justifyContent="space-between"
              variant="outline"
              fontWeight="normal"
              isDisabled={isDisabled}
              rightIcon={<span aria-hidden="true">▾</span>}
              role="combobox"
            >
              <Text noOfLines={1} color={selected ? "inherit" : "gray.500"}>
                {selected ? `${selected.code} — ${selected.name}` : placeholder}
              </Text>
            </Button>
          </PopoverTrigger>
          <PopoverContent p={2} zIndex={1500}>
            <PopoverArrow />
            <PopoverBody p={0}>
              <Input
                size="sm"
                autoFocus
                placeholder="Cari kode atau nama..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                mb={2}
                aria-label={`Cari ${placeholder}`}
              />
              <Box maxH="220px" overflowY="auto">
                {allowEmpty && (
                  <Button
                    size="sm"
                    variant="ghost"
                    width="100%"
                    justifyContent="flex-start"
                    onClick={() => {
                      onChange("");
                      setSearch("");
                      onClose();
                    }}
                  >
                    All
                  </Button>
                )}
                {filtered.length ? (
                  filtered.map((option) => (
                    <Button
                      key={option.code}
                      size="sm"
                      variant="ghost"
                      width="100%"
                      justifyContent="flex-start"
                      onClick={() => {
                        onChange(option.code);
                        setSearch("");
                        onClose();
                      }}
                    >
                      {option.code} — {option.name}
                    </Button>
                  ))
                ) : (
                  <Text px={3} py={2} fontSize="sm" color="gray.500">
                    Data tidak ditemukan
                  </Text>
                )}
              </Box>
            </PopoverBody>
          </PopoverContent>
        </>
      )}
    </Popover>
  );
}

type MappingActions = {
  onEdit: (row: Row) => void;
  onRemove: (row: Row) => void;
};

// Keep the large mapping table out of the render cycle while search inputs change.
const MappingTable = memo(function MappingTable({
  rows,
  actions,
  selectedRows,
  onSelectionChange,
  disabled,
}: {
  rows: Row[];
  actions: { current: MappingActions };
  selectedRows: string[];
  onSelectionChange: (next: string[]) => void;
  disabled: boolean;
}) {
  const getKey = (row: Row) =>
    `${row.productCode}|${row.supplierCode}|${row.supplierProductCode}`;
  const allSelected =
    rows.length > 0 && rows.every((row) => selectedRows.includes(getKey(row)));

  return (
    <Box className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>
              <input
                aria-label="Select all product suppliers"
                type="checkbox"
                checked={allSelected}
                disabled={disabled || rows.length === 0}
                onChange={(event) =>
                  onSelectionChange(
                    event.target.checked
                      ? [...new Set([...selectedRows, ...rows.map(getKey)])]
                      : selectedRows.filter(
                          (key) => !rows.some((row) => getKey(row) === key),
                        ),
                  )
                }
              />
            </th>
            <th>Product</th>
            <th>Supplier</th>
            <th>Supplier product code</th>
            <th style={{ textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getKey(row)}>
              <td>
                <input
                  aria-label={`Select ${row.productCode} / ${row.supplierCode} / ${row.supplierProductCode}`}
                  type="checkbox"
                  checked={selectedRows.includes(getKey(row))}
                  disabled={disabled}
                  onChange={(event) =>
                    onSelectionChange(
                      event.target.checked
                        ? [...new Set([...selectedRows, getKey(row)])]
                        : selectedRows.filter((key) => key !== getKey(row)),
                    )
                  }
                />
              </td>
              <td>{row.productCode}</td>
              <td>{row.supplierCode}</td>
              <td>{row.supplierProductCode}</td>
              <td>
                <HStack justify="end" spacing={1}>
                  <Tooltip label="Update">
                    <IconButton
                      aria-label="Update mapping"
                      size="sm"
                      variant="ghost"
                      icon={<Pencil size={15} />}
                      onClick={() => actions.current.onEdit(row)}
                    />
                  </Tooltip>
                  <Tooltip label="Delete">
                    <IconButton
                      aria-label="Delete mapping"
                      size="sm"
                      variant="ghost"
                      colorScheme="red"
                      icon={<Trash2 size={15} />}
                      onClick={() => actions.current.onRemove(row)}
                    />
                  </Tooltip>
                </HStack>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
});

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const routeSection =
    location.pathname.split("/").filter(Boolean)[0] || "dashboard";
  const active = (
    routeSection in CFG || routeSection === "dashboard"
      ? routeSection
      : "dashboard"
  ) as Key;
  const navigateSection = (section: Key) =>
    navigate(section === "dashboard" ? "/" : `/${section}/find`);
  const [rows, setRows] = useState<Row[]>([]),
    [loadedLocation, setLoadedLocation] = useState(""),
    [filters, setFilters] = useState<Record<string, string>>({}),
    [options, setOptions] = useState<Record<string, Row[]>>({}),
    [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [deletingKey, setDeletingKey] = useState<string | null>(null),
    [mappingOpening, setMappingOpening] = useState(false),
    [networkRequests, setNetworkRequests] = useState(0),
    [error, setError] = useState(""),
    [editing, setEditing] = useState<Row | null>(null),
    [mappingMode, setMappingMode] = useState(false),
    [form, setForm] = useState<Row>({}),
    [detailProduct, setDetailProduct] = useState<Row | null>(null),
    [detailRows, setDetailRows] = useState<Row[]>([]),
    [detailLoading, setDetailLoading] = useState(false),
    [syncing, setSyncing] = useState(false),
    [lastSynced, setLastSynced] = useState<any>(null),
    [selectedRows, setSelectedRows] = useState<string[]>([]),
    [bulkBusy, setBulkBusy] = useState(false),
    [importSource, setImportSource] = useState<"standard" | "otomax">(
      "standard",
    );
  const modal = useDisclosure(),
    detail = useDisclosure(),
    importModal = useDisclosure();
  const toast = useToast();
  useEffect(() => {
    const update = (event: Event) => {
      setNetworkRequests(
        (event as CustomEvent<{ active: number }>).detail.active,
      );
    };
    window.addEventListener("app:network-activity", update);
    return () => window.removeEventListener("app:network-activity", update);
  }, []);
  const { colorMode, toggleColorMode } = useColorMode();
  const dark = colorMode === "dark";
  const cfg = active === "dashboard" ? null : CFG[active];
  const formCfg = mappingMode ? CFG["product-suppliers"] : cfg;
  // Avoid rendering the empty-state spacer for one frame while a newly
  // selected section is waiting for its first request to start.
  const currentLocation = `${location.pathname}${location.search}`;
  const pageLoading = loading || (!!cfg && loadedLocation !== currentLocation);
  const notify = (t: string, d?: string, s: "success" | "error" = "success") =>
    toast({
      title: t,
      description: d,
      status: s,
      duration: 3500,
      isClosable: true,
      position: "top-right",
    });
  // Draft filters are edited locally. Only submitted filters are sent to the API.
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>(
    {},
  );

  // Ignore responses from previous routes/searches. Browser back/forward can
  // otherwise let an older request overwrite the current Product Suppliers table.
  const loadRequestRef = useRef(0);
  const load = useCallback(
    async (searchFilters: Record<string, string> = {}) => {
      if (!cfg) return;
      const requestId = ++loadRequestRef.current;
      const endpoint = cfg.endpoint;
      const requestLocation = `${location.pathname}${location.search}`;
      setLoading(true);
      setError("");
      try {
        const data = await request<Row[]>(
          `/${endpoint}/find${queryString(searchFilters)}`,
        );
        if (requestId === loadRequestRef.current) {
          setRows(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        if (requestId === loadRequestRef.current) {
          setRows([]);
          setError((e as Error).message);
        }
      } finally {
        if (requestId === loadRequestRef.current) {
          setLoading(false);
          setLoadedLocation(requestLocation);
        }
      }
    },
    [cfg?.endpoint, location.pathname, location.search],
  );

  // URL is the source of truth: filters survive refresh and can be shared/bookmarked.
  const routeFilters = useMemo(
    () => Object.fromEntries(new URLSearchParams(location.search).entries()),
    [location.search],
  );
  useEffect(() => {
    // Invalidate any in-flight request before switching sections (including
    // browser back/forward to the dashboard, where no replacement request runs).
    loadRequestRef.current++;
    setLoading(false);
    setRows([]);
    setError("");
    setFilters(routeFilters);
    setAppliedFilters(routeFilters);
    setSelectedRows([]);

    if (cfg) void load(routeFilters);
  }, [active, location.pathname, location.search]);

  const submitSearch = () => {
    const nextFilters = { ...filters };
    setAppliedFilters(nextFilters);
    navigate(`/${cfg?.endpoint}/find${queryString(nextFilters)}`);
  };
  const submitProductSupplierSearch = submitSearch;

  const getOptions = useCallback(async (endpoint: string, refresh = false) => {
    // The shared request cache is the single source of cache truth.
    // Explicit refresh bypasses that endpoint's cached entries.
    if (refresh) clearCacheByPrefix(`/${endpoint}`);
    try {
      const data = await request<Row[]>(`/${endpoint}/find`);
      const list = Array.isArray(data) ? data : [];
      setOptions((p) => ({ ...p, [endpoint]: list }));
      return list;
    } catch (error) {
      if (refresh) throw error;
      return [];
    }
  }, []);
  useEffect(() => {
    if (cfg)
      cfg.fields.filter((f) => f.fk).forEach((f) => void getOptions(f.fk!));
    if (cfg?.fk) void getOptions(cfg.fk.endpoint);

    // Products also needs the Supplier relation for the mapping modal,
    // although Supplier is not a field in the Product form itself.
    if (active === "products") void getOptions("suppliers");
  }, [active]);
  const dashboard = useCallback(async () => {
    try {
      setLastSynced(await request<any>("/sync/last-synced"));
    } catch {
      setLastSynced(null);
    }
  }, []);
  useEffect(() => {
    if (active === "dashboard") void dashboard();
  }, [active, dashboard]);
  const openCreate = () => {
    setMappingMode(false);
    setEditing(null);
    setForm({});
    modal.onOpen();
  };
  const openEdit = (r: Row) => {
    setMappingMode(false);
    setEditing(r);
    setForm({ ...r });
    modal.onOpen();
  };
  const openProductSuppliers = async (p: Row) => {
    setDetailProduct(p);
    setDetailRows([]);
    setDetailLoading(true);
    detail.onOpen();
    try {
      setDetailRows(
        await request<Row[]>(
          `/product-suppliers/find/${encodeURIComponent(p.code)}`,
        ),
      );
    } catch (e) {
      notify("Gagal memuat mapping", (e as Error).message, "error");
    } finally {
      setDetailLoading(false);
    }
  };

  // Mapping can be opened directly from the Products detail modal. In that
  // flow, the active section is still "products", so its normal FK loader only
  // loads providers. Explicitly load suppliers for the mapping combobox.
  const openMappingForm = async (record?: Row) => {
    if (mappingOpening) return;
    setMappingOpening(true);
    // Refresh the actual Supplier master-data list before showing the mapping
    // form. This prevents the dropdown from relying on Provider options or a
    // stale/empty Supplier cache from a previous request.
    let supplierOptions: Row[];
    try {
      supplierOptions = await getOptions("suppliers", true);
    } catch (e) {
      notify("Gagal memuat supplier", (e as Error).message, "error");
      setMappingOpening(false);
      return;
    }

    if (!supplierOptions.length) {
      notify(
        "Supplier tidak ditemukan",
        "Pastikan data Supplier sudah ditambahkan dan endpoint /suppliers/find mengembalikan daftar Supplier.",
        "error",
      );
      setMappingOpening(false);
      return;
    }

    setMappingOpening(false);
    detail.onClose();
    setMappingMode(true);
    setEditing(record || null);
    setForm(
      record
        ? {
            ...record,
            productCode: record.productCode || detailProduct?.code || "",
          }
        : { productCode: detailProduct?.code || "" },
    );
    modal.onOpen();
  };

  const save = async () => {
    const currentCfg = formCfg;
    if (!currentCfg) return;
    const isMapping = mappingMode || active === "product-suppliers";

    for (const f of currentCfg.fields) {
      const v = String(form[f.name] ?? "").trim();
      if (f.required && !v) {
        notify("Validasi gagal", `${f.label} wajib diisi`, "error");
        return;
      }
      if (!v) continue;
      if (
        [
          "code",
          "providerCode",
          "targetTypeCode",
          "productCode",
          "supplierCode",
        ].includes(f.name) &&
        !validCode(v) &&
        !(isMapping && f.name === "productCode")
      ) {
        notify(
          "Code tidak valid",
          `${f.label}: huruf kapital, angka, underscore; maksimal 16 karakter.`,
          "error",
        );
        return;
      }
      if (f.name === "name" && v.length > 64) {
        notify("Nama terlalu panjang", "Maksimal 64 karakter.", "error");
        return;
      }
      if (f.name === "supplierProductCode" && v.length > 500) {
        notify("Code terlalu panjang", "Maksimal 500 karakter.", "error");
        return;
      }
      if (f.url) {
        try {
          new URL(v);
        } catch {
          notify(
            "URL tidak valid",
            "Masukkan URL lengkap dengan https://",
            "error",
          );
          return;
        }
      }
    }

    const body: Row = {};
    currentCfg.fields.forEach((f) => {
      const v = String(form[f.name] ?? "").trim();
      if (v) body[f.name] = v;
    });

    if (saving) return;
    setSaving(true);
    try {
      if (isMapping) {
        if (editing)
          await post(
            `/product-suppliers/update/${encodeURIComponent(editing.productCode)}/${encodeURIComponent(editing.supplierCode)}/${encodeURIComponent(editing.supplierProductCode)}`,
            body,
          );
        else await post("/product-suppliers/create", body);
      } else if (editing)
        await post(
          `/${currentCfg.endpoint}/update/${encodeURIComponent(editing.code)}`,
          body,
        );
      else await post(`/${currentCfg.endpoint}/create`, body);

      notify(editing ? "Data diperbarui" : "Data ditambahkan");
      modal.onClose();

      if (isMapping && active === "product-suppliers") {
        // Keep the Product Suppliers table in sync locally after a successful
        // mutation. No list refetch / page reload is needed.
        const previousKey = editing ? rowKey(editing) : null;
        const nextRow = { ...(editing || {}), ...body };
        const nextKey = `${nextRow.productCode}|${nextRow.supplierCode}|${nextRow.supplierProductCode}`;
        setRows((current) => {
          if (editing) {
            return current.flatMap((row) => {
              if (rowKey(row) !== previousKey) return [row];
              return matchesProductSupplierFilters(nextRow, appliedFilters)
                ? [nextRow]
                : [];
            });
          }
          if (!matchesProductSupplierFilters(nextRow, appliedFilters))
            return current;
          return current.some((row) => rowKey(row) === nextKey)
            ? current.map((row) => (rowKey(row) === nextKey ? nextRow : row))
            : [...current, nextRow];
        });
        setSelectedRows((current) =>
          previousKey ? current.filter((key) => key !== previousKey) : current,
        );
      }

      if (isMapping) {
        const productCode = String(
          body.productCode || editing?.productCode || detailProduct?.code || "",
        ).trim();

        if (productCode && active !== "product-suppliers") {
          try {
            setDetailRows(
              await request<Row[]>(
                `/product-suppliers/find/${encodeURIComponent(productCode)}`,
              ),
            );
            const product =
              options.products?.find((p) => p.code === productCode) ||
              (detailProduct?.code === productCode ? detailProduct : null);
            if (product) setDetailProduct(product);

            // If mapping was managed from the Products page, return to its
            // product-supplier detail modal instead of navigating sections.
            if (mappingMode && active === "products") detail.onOpen();
          } catch {
            // The mapping operation succeeded; refreshing the detail is best-effort.
            if (mappingMode && active === "products") detail.onOpen();
          }
        }
        setMappingMode(false);
      } else {
        await load(appliedFilters);
      }

      await dashboard();
    } catch (e) {
      notify("Operasi gagal", (e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };
  const remove = async (r: Row, fromDetail = false) => {
    if (!window.confirm("Yakin ingin menghapus data ini?")) return;
    const key = fromDetail
      ? `${r.productCode}|${r.supplierCode}|${r.supplierProductCode}`
      : rowKey(r);
    if (deletingKey) return;
    setDeletingKey(key);
    try {
      if (active === "product-suppliers" || fromDetail)
        await post(
          `/product-suppliers/delete/${encodeURIComponent(r.productCode)}/${encodeURIComponent(r.supplierCode)}/${encodeURIComponent(r.supplierProductCode)}`,
        );
      else await post(`/${cfg!.endpoint}/delete/${encodeURIComponent(r.code)}`);
      notify("Data berhasil dihapus");
      if (fromDetail && detailProduct) {
        await openProductSuppliers(detailProduct);
      } else {
        if (active === "product-suppliers") {
          setRows((current) => current.filter((row) => rowKey(row) !== key));
          setSelectedRows((current) =>
            current.filter((selected) => selected !== key),
          );
        } else {
          await load(appliedFilters);
        }
        await dashboard();
      }
    } catch (e) {
      notify("Tidak dapat menghapus data", (e as Error).message, "error");
    } finally {
      setDeletingKey(null);
    }
  };
  const rowKey = (r: Row) =>
    active === "product-suppliers"
      ? `${r.productCode}|${r.supplierCode}|${r.supplierProductCode}`
      : String(r.code ?? "");

  // Mirror the Product Suppliers API's filter syntax for optimistic inserts
  // and updates so a locally-created row is only shown when it matches search.
  const matchesProductSupplierFilters = (
    row: Row,
    searchFilters: Record<string, string>,
  ) =>
    Object.entries(searchFilters).every(([field, raw]) => {
      const filter = String(raw || "").trim();
      if (!filter) return true;
      const value = String(row[field] ?? "");
      if (filter.startsWith("!")) return !value.includes(filter.slice(1));
      if (filter.startsWith("%") && filter.endsWith("%") && filter.length > 2)
        return value.includes(filter.slice(1, -1));
      return value === filter;
    });

  // The ref stays stable, while its callbacks always point to the latest state.
  // This lets MappingTable skip renders caused only by typing in the filters.
  const mappingActionsRef = useRef<MappingActions>({
    onEdit: openEdit,
    onRemove: (row) => void remove(row),
  });
  mappingActionsRef.current = {
    onEdit: openEdit,
    onRemove: (row) => void remove(row),
  };

  const downloadExcelTemplate = () => {
    const currentCfg = cfg;
    if (!currentCfg) return;
    const headers = currentCfg.fields.map((f) => f.name);
    const example: Row = {};
    currentCfg.fields.forEach((f) => {
      example[f.name] = f.fk
        ? (options[f.fk]?.[0]?.code ??
          (f.name === "providerCode"
            ? "PROVIDER_CODE"
            : f.name === "targetTypeCode"
              ? "TARGET_TYPE_CODE"
              : f.name === "productCode"
                ? "PRODUCT_CODE"
                : "SUPPLIER_CODE"))
        : f.name === "productListUrl"
          ? "https://example.com/products"
          : f.name === "name"
            ? "Contoh nama"
            : f.name === "code"
              ? "EXAMPLE_CODE"
              : f.name === "supplierProductCode"
                ? "SUPPLIER_SKU_001"
                : "";
    });
    const ws = XLSX.utils.aoa_to_sheet([
      headers,
      headers.map((h) => example[h]),
    ]);
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(18, h.length + 4) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Petunjuk"],
        [
          "Isi data mulai baris ke-2 pada sheet Data; jangan mengubah nama kolom.",
        ],
        [
          "Kolom wajib",
          currentCfg.fields
            .filter((f) => f.required)
            .map((f) => f.name)
            .join(", "),
        ],
        [
          "Kode relasi harus sudah ada di database",
          currentCfg.fields
            .filter((f) => f.fk)
            .map((f) => `${f.name} (${f.fk})`)
            .join(", "),
        ],
        [
          "Kode",
          "Gunakan huruf kapital, angka, dan underscore; maksimal 16 karakter.",
        ],
        [
          "URL",
          "productListUrl harus berupa URL lengkap, misalnya https://example.com/products.",
        ],
        [
          "Import",
          "Baris yang gagal akan dilaporkan; baris sukses tetap tersimpan.",
        ],
      ]),
      "Petunjuk",
    );
    XLSX.writeFile(wb, `${currentCfg.endpoint}-template.xlsx`);
  };

  const importExcel = async (file?: File) => {
    if (!file || !cfg) return;
    // Both Excel and Otomax imports are insert-only.
    setBulkBusy(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet =
        workbook.Sheets["Data"] || workbook.Sheets[workbook.SheetNames[0]];
      const records = XLSX.utils.sheet_to_json<Row>(sheet, {
        defval: "",
        raw: false,
      });
      if (!records.length) throw new Error("Excel tidak berisi baris data.");

      const otomaxMap: Record<string, string> =
        active === "products"
          ? { Kode: "code", Provider: "providerCode", Nama: "name" }
          : active === "product-suppliers"
            ? {
                Produk: "productCode",
                Modul: "supplierCode",
                Perintah: "supplierProductCode",
              }
            : {};
      if (importSource === "otomax" && !Object.keys(otomaxMap).length)
        throw new Error(
          "Import Otomax hanya tersedia untuk Products dan Product Suppliers.",
        );

      const normalized = records.map((record, index) => {
        const source =
          importSource === "otomax"
            ? Object.fromEntries(
                Object.entries(otomaxMap).map(([header, field]) => [
                  field,
                  record[header],
                ]),
              )
            : record;
        const allowed = cfg.fields.map((f) => f.name);
        const unknown = Object.keys(source).filter(
          (key) => !allowed.includes(key),
        );
        if (unknown.length)
          throw new Error(
            `Baris Excel ${index + 2}: kolom tidak dikenal: ${unknown.join(", ")}.`,
          );
        const row: Row = {};
        for (const field of cfg.fields) {
          const value = source[field.name];
          row[field.name] = value == null ? "" : String(value).trim();
        }
        if (importSource === "otomax" && active === "product-suppliers") {
          row.supplierProductCode =
            parseSupplierProductCode(row.supplierProductCode) ?? "";
        }
        for (const field of cfg.fields) {
          const value = row[field.name];
          if (field.required && !value)
            throw new Error(
              `Baris Excel ${index + 2}: kolom ${field.name} wajib diisi.`,
            );
          if (
            [
              "code",
              "providerCode",
              "targetTypeCode",
              "productCode",
              "supplierCode",
            ].includes(field.name) &&
            value &&
            !validCode(value)
          )
            throw new Error(
              `Baris Excel ${index + 2}: ${field.name} tidak valid (huruf kapital, angka, underscore; maksimal 16 karakter).`,
            );
          if (field.name === "name" && value.length > 64)
            throw new Error(
              `Baris Excel ${index + 2}: name maksimal 64 karakter.`,
            );
          if (field.name === "supplierProductCode" && value.length > 500)
            throw new Error(
              `Baris Excel ${index + 2}: supplierProductCode maksimal 500 karakter.`,
            );
          if (field.url && value) {
            try {
              new URL(value);
            } catch {
              throw new Error(
                `Baris Excel ${index + 2}: ${field.name} harus berupa URL lengkap.`,
              );
            }
          }
        }
        return row;
      });

      if (
        !window.confirm(
          `Import ${normalized.length} baris ke ${cfg.title} menggunakan ${importSource === "otomax" ? "format Otomax" : "format Excel biasa"} dengan mode Insert (data baru)?`,
        )
      )
        return;

      let succeeded = 0;
      const failures: string[] = [];
      const successfulRows: Row[] = [];
      for (let i = 0; i < normalized.length; i++) {
        const row = normalized[i];
        try {
          await post(
            importSource === "otomax"
              ? active === "products"
                ? "/products/create"
                : active === "product-suppliers"
                  ? "/product-suppliers/create"
                  : `/${cfg.endpoint}/create`
              : `/${cfg.endpoint}/create`,
            row,
          );
          succeeded++;
          successfulRows.push(row);
        } catch (e) {
          failures.push(`Baris ${i + 2}: ${(e as Error).message}`);
        }
      }
      setSelectedRows([]);
      if (active === "product-suppliers") {
        setRows((current) => {
          let next = [...current];
          for (const importedRow of successfulRows) {
            const key = `${importedRow.productCode}|${importedRow.supplierCode}|${importedRow.supplierProductCode}`;
            const index = next.findIndex((row) => rowKey(row) === key);
            if (!matchesProductSupplierFilters(importedRow, appliedFilters)) {
              if (index >= 0) next.splice(index, 1);
            } else if (index >= 0) {
              next[index] = { ...next[index], ...importedRow };
            } else {
              next.push(importedRow);
            }
          }
          return next;
        });
      } else {
        await load(appliedFilters);
      }
      await dashboard();
      if (failures.length)
        notify(
          `Import selesai: ${succeeded}/${normalized.length} berhasil`,
          failures.slice(0, 3).join(" | ") +
            (failures.length > 3
              ? ` | dan ${failures.length - 3} error lainnya`
              : ""),
          "error",
        );
      else
        notify("Import berhasil", `${succeeded} baris berhasil ditambahkan.`);
    } catch (e) {
      notify("Import gagal", (e as Error).message, "error");
    } finally {
      setBulkBusy(false);
      importModal.onClose();
    }
  };

  const bulkDelete = async () => {
    if (!cfg || !selectedRows.length) return;
    const selected = rows.filter((r) => selectedRows.includes(rowKey(r)));
    if (
      !window.confirm(
        `Hapus ${selected.length} data terpilih? Tindakan ini tidak dapat dibatalkan.`,
      )
    )
      return;
    setBulkBusy(true);
    try {
      let succeeded = 0;
      const failures: string[] = [];
      const deletedKeys = new Set<string>();
      for (const r of selected) {
        try {
          if (active === "product-suppliers") {
            await post(
              `/product-suppliers/delete/${encodeURIComponent(r.productCode)}/${encodeURIComponent(r.supplierCode)}/${encodeURIComponent(r.supplierProductCode)}`,
            );
          } else {
            await post(`/${cfg.endpoint}/delete/${encodeURIComponent(r.code)}`);
          }
          succeeded++;
          deletedKeys.add(rowKey(r));
        } catch (e) {
          const identifier =
            active === "product-suppliers"
              ? `${r.productCode}/${r.supplierCode}/${r.supplierProductCode}`
              : String(r.code);
          failures.push(`${identifier}: ${(e as Error).message}`);
        }
      }
      setSelectedRows([]);
      if (active === "product-suppliers") {
        setRows((current) =>
          current.filter((row) => !deletedKeys.has(rowKey(row))),
        );
      } else {
        await load(appliedFilters);
      }
      await dashboard();
      if (failures.length)
        notify(
          `Hapus selesai: ${succeeded}/${selected.length} berhasil`,
          failures.slice(0, 3).join(" | ") +
            (failures.length > 3
              ? ` | dan ${failures.length - 3} error lainnya`
              : ""),
          "error",
        );
      else notify("Bulk delete berhasil", `${succeeded} data dihapus.`);
    } finally {
      setBulkBusy(false);
    }
  };

  const sync = async () => {
    if (!window.confirm("Jalankan sinkronisasi seluruh supplier sekarang?"))
      return;
    setSyncing(true);
    try {
      await post("/sync");
      notify("Sinkronisasi selesai", "Data product-supplier telah diperbarui.");
      await dashboard();
      if (active === "products") await load(appliedFilters);
    } catch (e) {
      notify("Sinkronisasi gagal", (e as Error).message, "error");
    } finally {
      setSyncing(false);
    }
  };
  const columns = useMemo(
    () =>
      rows.length
        ? Object.keys(rows[0]).filter(
            (k) => !["createdAt", "updatedAt"].includes(k),
          )
        : cfg?.fields.map((f) => f.name) || [],
    [rows, cfg],
  );
  const cell = (r: Row, k: string) =>
    k === "price" ||
    k === "bestPrice" ||
    k === "lowestPrice" ||
    k === "highestPrice" ? (
      money(r[k])
    ) : k === "status" ? (
      <Badge
        colorScheme={
          r.status === "active"
            ? "green"
            : r.status === "not-found"
              ? "red"
              : r.status === "inactive"
                ? "orange"
                : "gray"
        }
      >
        {r.status}
      </Badge>
    ) : k.toLowerCase().includes("at") ? (
      date(r[k])
    ) : k === "productListUrl" ? (
      <Text maxW="230px" isTruncated>
        {r[k]}
      </Text>
    ) : (
      (r[k] ?? "—")
    );
  return (
    <Flex
      minH="100vh"
      bg={dark ? "gray.950" : "gray.50"}
      color={dark ? "gray.100" : "gray.800"}
    >
      <Box
        className="sidebar"
        bg={dark ? "gray.900" : "white"}
        borderRightWidth="1px"
        borderColor={dark ? "whiteAlpha.100" : "gray.200"}
        p={4}
      >
        <HStack px={2} py={3} mb={7}>
          <Box className="brand-text">
            <Text fontWeight="800" fontSize="xl">
              BK{" "}
              <Text as="span" color="brand.500">
                Jaya jaya jaya
              </Text>
            </Text>
            <Text fontSize="sm" color="gray.500">
              Supplier comparator
            </Text>
          </Box>
        </HStack>
        {["WORKSPACE", "MASTER DATA", "MAPPING"].map((g) => (
          <Box key={g} mb={5}>
            <Text
              className="nav-caption"
              px={3}
              mb={2}
              fontSize="10px"
              letterSpacing="1.2px"
              fontWeight="800"
              color="gray.400"
            >
              {g}
            </Text>
            {NAV.filter((n) => n.group === g).map((n) => {
              const I = n.icon;
              return (
                <button
                  key={n.key}
                  className={`nav-item ${active === n.key ? "active" : ""}`}
                  onClick={() => {
                    navigateSection(n.key);
                  }}
                  title={n.label}
                >
                  <I size={17} />
                  <span className="nav-label">{n.label}</span>
                </button>
              );
            })}
          </Box>
        ))}
      </Box>
      <Box className="main-area" flex="1" minW={0} overflowX={"hidden"}>
        <Flex
          as="header"
          h="72px"
          px={{ base: 4, md: 8 }}
          align="center"
          borderBottomWidth="1px"
          borderColor={dark ? "whiteAlpha.100" : "gray.200"}
          bg={dark ? "gray.900" : "white"}
          position="sticky"
          top={0}
          zIndex={10}
        >
          <HStack spacing={3}>
            <Text fontSize="sm" color="gray.500">
              Workspace /
            </Text>
            <Text fontSize="sm" fontWeight="700">
              {cfg?.title || "Overview"}
            </Text>
          </HStack>
          <Spacer />
          <HStack>
            <Text
              fontSize="sm"
              color="gray.500"
              display={{ base: "none", sm: "block" }}
            >
              {user?.username}
            </Text>
            <Tooltip label="Logout">
              <IconButton
                aria-label="Logout"
                icon={<LogOut size={17} />}
                variant="ghost"
                onClick={async () => {
                  try {
                    await logout();
                  } finally {
                    navigate("/login", { replace: true });
                  }
                }}
              />
            </Tooltip>
            <Tooltip label="Run synchronization">
              <IconButton
                aria-label="Sync"
                icon={<RefreshCw size={17} />}
                variant="ghost"
                onClick={sync}
                isLoading={syncing}
              />
            </Tooltip>
            <IconButton
              aria-label="Toggle theme"
              icon={dark ? <Sun size={17} /> : <Moon size={17} />}
              variant="ghost"
              onClick={toggleColorMode}
            />
          </HStack>
        </Flex>
        {networkRequests > 0 && (
          <Progress
            position="fixed"
            top={0}
            left={0}
            right={0}
            zIndex={2000}
            size="xs"
            isIndeterminate
            colorScheme="brand"
            aria-label="Memuat data"
          />
        )}
        <Container maxW="container.2xl" p={{ base: 4, md: 8 }}>
          {active === "dashboard" ? (
            <Stack spacing={7}>
              <Box>
                <Badge colorScheme="red" mb={2}>
                  SUPPLIER PRICE COMPARATOR
                </Badge>
                <Heading size="lg">Overview</Heading>
                <Text color="gray.500" mt={1} fontSize="sm">
                  Pantau dan proses sinkronisasi harga supplier.
                </Text>
              </Box>
              <Grid templateColumns={{ base: "1fr", lg: "1.3fr 1fr" }} gap={4}>
                <Box
                  p={6}
                  rounded="2xl"
                  bg={dark ? "gray.900" : "white"}
                  borderWidth="1px"
                >
                  <HStack mb={4}>
                    <Activity size={19} />
                    <Heading size="sm">Quick navigation</Heading>
                  </HStack>
                  <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
                    {NAV.filter((n) => n.key !== "dashboard").map((n) => (
                      <Button
                        key={n.key}
                        variant="outline"
                        justifyContent="start"
                        onClick={() => {
                          navigateSection(n.key);
                        }}
                      >
                        {n.label}
                      </Button>
                    ))}
                  </SimpleGrid>
                </Box>
                <Box
                  p={6}
                  rounded="2xl"
                  bg={dark ? "gray.900" : "white"}
                  borderWidth="1px"
                >
                  <HStack>
                    <Clock3 size={18} />
                    <Heading size="sm">Last synchronization</Heading>
                  </HStack>
                  <Heading size="lg" mt={4}>
                    {lastSynced?.lastSyncedAt
                      ? date(lastSynced.lastSyncedAt)
                      : "Belum ada data"}
                  </Heading>
                  <Text color="gray.500" fontSize="sm" mt={2}>
                    Waktu sinkronisasi supplier terakhir.
                  </Text>
                  <Button
                    mt={5}
                    colorScheme="brand"
                    leftIcon={<RefreshCw size={15} />}
                    onClick={sync}
                    isLoading={syncing}
                  >
                    Run sync
                  </Button>
                </Box>
              </Grid>
            </Stack>
          ) : (
            <Stack spacing={5}>
              <Flex
                justify="space-between"
                align={{ base: "start", md: "end" }}
                direction={{ base: "column", md: "row" }}
                gap={3}
              >
                <Box>
                  <Heading size="lg">{cfg?.title}</Heading>
                </Box>
                <HStack wrap="wrap">
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={downloadExcelTemplate}
                      isDisabled={bulkBusy}
                    >
                      Download Excel template
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setImportSource("standard");
                        importModal.onOpen();
                      }}
                      isDisabled={bulkBusy}
                    >
                      Import Excel
                    </Button>
                    {(active === "products" ||
                      active === "product-suppliers") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setImportSource("otomax");
                          importModal.onOpen();
                        }}
                        isDisabled={bulkBusy}
                      >
                        Import from Otomax
                      </Button>
                    )}
                    {cfg?.crud && selectedRows.length > 0 && (
                      <Button
                        size="sm"
                        colorScheme="red"
                        leftIcon={<Trash2 size={14} />}
                        onClick={() => void bulkDelete()}
                        isLoading={bulkBusy}
                      >
                        Delete selected ({selectedRows.length})
                      </Button>
                    )}
                  </>
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<RefreshCw size={14} />}
                    onClick={() => {
                      clearAllCache();
                      void load(appliedFilters);
                    }}
                    isLoading={loading}
                  >
                    Refresh
                  </Button>
                  {(cfg?.crud || active === "target-types") && (
                    <Button
                      size="sm"
                      colorScheme="brand"
                      leftIcon={<Plus size={15} />}
                      onClick={openCreate}
                    >
                      Add new
                    </Button>
                  )}
                </HStack>
              </Flex>
              {active === "product-suppliers" ? (
                <>
                  <Box
                    p={5}
                    rounded="2xl"
                    bg={dark ? "gray.900" : "white"}
                    borderWidth="1px"
                  >
                    <HStack mb={4}>
                      <Search size={17} />
                      <Text fontWeight="700" fontSize="sm">
                        Search & filters
                      </Text>
                      <Spacer />
                      <Button
                        size="xs"
                        variant="ghost"
                        leftIcon={<X size={13} />}
                        onClick={() => {
                          setFilters({});
                          setAppliedFilters({});
                          navigate(`/${cfg?.endpoint}/find`);
                        }}
                      >
                        Clear
                      </Button>
                    </HStack>
                    <Grid
                      templateColumns={{
                        base: "1fr",
                        md: "repeat(3,minmax(0,1fr)) auto",
                      }}
                      gap={3}
                      alignItems="end"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          submitProductSupplierSearch();
                        }
                      }}
                    >
                      <FormControl>
                        <FormLabel fontSize="xs" color="gray.500">
                          Product Code
                        </FormLabel>
                        <Input
                          size="sm"
                          placeholder="Exact / %contains% / !exclude"
                          value={filters.productCode || ""}
                          onChange={(e) =>
                            setFilters((p) => ({
                              ...p,
                              productCode: e.target.value,
                            }))
                          }
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel fontSize="xs" color="gray.500">
                          Supplier Product Code
                        </FormLabel>
                        <Input
                          size="sm"
                          placeholder="Exact / %contains% / !exclude"
                          value={filters.supplierProductCode || ""}
                          onChange={(e) =>
                            setFilters((p) => ({
                              ...p,
                              supplierProductCode: e.target.value,
                            }))
                          }
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel fontSize="xs" color="gray.500">
                          Supplier Code
                        </FormLabel>
                        <RelationCombobox
                          value={filters.supplierCode || ""}
                          options={options.suppliers || []}
                          placeholder="All suppliers"
                          allowEmpty
                          onChange={(value) =>
                            setFilters((p) => ({ ...p, supplierCode: value }))
                          }
                        />
                      </FormControl>
                      <Button
                        size="sm"
                        colorScheme="brand"
                        leftIcon={<Search size={14} />}
                        onClick={submitProductSupplierSearch}
                      >
                        Search
                      </Button>
                    </Grid>
                  </Box>
                  <Box
                    rounded="2xl"
                    bg={dark ? "gray.900" : "white"}
                    borderWidth="1px"
                    overflow="hidden"
                  >
                    <Flex p={4} align="center">
                      <Box>
                        <Text fontWeight="700" fontSize="sm">
                          Data records
                        </Text>
                        <Text color="gray.500" fontSize="xs">
                          {pageLoading
                            ? "Loading..."
                            : `${rows.length} records found`}
                        </Text>
                      </Box>
                    </Flex>
                    {error && (
                      <Alert status="error" mx={4} mb={3} rounded="lg">
                        <AlertIcon />
                        {error}
                      </Alert>
                    )}
                    {pageLoading ? (
                      <Stack p={5}>
                        <Skeleton h="20px" />
                        <SkeletonText noOfLines={5} />
                      </Stack>
                    ) : !rows.length ? (
                      <VStack py={14}>
                        <Box
                          p={4}
                          rounded="xl"
                          bg={dark ? "whiteAlpha.100" : "gray.100"}
                          color="gray.400"
                        >
                          <Database size={24} />
                        </Box>
                        <Text fontWeight="bold">No records found</Text>
                        <Text color="gray.500" fontSize="sm">
                          Ubah filter atau tambahkan data baru.
                        </Text>
                      </VStack>
                    ) : (
                      <MappingTable
                        rows={rows}
                        actions={mappingActionsRef}
                        selectedRows={selectedRows}
                        onSelectionChange={setSelectedRows}
                        disabled={bulkBusy}
                      />
                    )}
                  </Box>
                </>
              ) : (
                <>
                  <Box
                    p={5}
                    rounded="2xl"
                    bg={dark ? "gray.900" : "white"}
                    borderWidth="1px"
                  >
                    <HStack mb={4}>
                      <Search size={17} />
                      <Text fontWeight="700" fontSize="sm">
                        Search & filters
                      </Text>
                      <Spacer />
                      <Button
                        size="xs"
                        variant="ghost"
                        leftIcon={<X size={13} />}
                        onClick={() => {
                          setFilters({});
                          setAppliedFilters({});
                          navigate(`/${cfg?.endpoint}/find`);
                        }}
                      >
                        Clear
                      </Button>
                    </HStack>
                    <Grid
                      templateColumns={{
                        base: "1fr",
                        md: `repeat(${cfg?.fk ? 3 : 2},minmax(0,1fr)) auto`,
                      }}
                      gap={3}
                      alignItems="end"
                    >
                      {cfg?.search.map((k) => (
                        <FormControl key={k}>
                          <FormLabel fontSize="xs" color="gray.500">
                            {title(k)}
                          </FormLabel>
                          {k === cfg.fk?.key ? (
                            <RelationCombobox
                              value={filters[k] || ""}
                              options={options[cfg.fk.endpoint] || []}
                              placeholder={`All ${cfg.fk.label}`}
                              allowEmpty
                              onChange={(value) =>
                                setFilters((p) => ({ ...p, [k]: value }))
                              }
                            />
                          ) : (
                            <Input
                              size="sm"
                              maxLength={k === "code" ? 16 : 32}
                              value={filters[k] || ""}
                              placeholder="Exact / %contains% / !exclude"
                              onChange={(e) =>
                                setFilters((p) => ({
                                  ...p,
                                  [k]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  submitSearch();
                                }
                              }}
                            />
                          )}
                        </FormControl>
                      ))}
                      <Button
                        size="sm"
                        colorScheme="brand"
                        leftIcon={<Search size={14} />}
                        onClick={() => {
                          submitSearch();
                        }}
                        isLoading={loading}
                        isDisabled={loading}
                      >
                        Search
                      </Button>
                    </Grid>
                  </Box>
                  <Box
                    rounded="2xl"
                    bg={dark ? "gray.900" : "white"}
                    borderWidth="1px"
                    overflow="hidden"
                  >
                    <Flex p={4} align="center">
                      <Box>
                        <Text fontWeight="700" fontSize="sm">
                          Data records
                        </Text>
                        <Text color="gray.500" fontSize="xs">
                          {pageLoading
                            ? "Loading..."
                            : `${rows.length} records found`}
                        </Text>
                      </Box>
                      <Spacer />
                    </Flex>
                    {error && (
                      <Alert status="error" mx={4} mb={3} rounded="lg">
                        <AlertIcon />
                        {error}
                      </Alert>
                    )}
                    {pageLoading ? (
                      <Stack p={5}>
                        <Skeleton h="20px" />
                        <SkeletonText noOfLines={5} />
                      </Stack>
                    ) : !rows.length ? (
                      <VStack py={14}>
                        <Box
                          p={4}
                          rounded="xl"
                          bg={dark ? "whiteAlpha.100" : "gray.100"}
                          color="gray.400"
                        >
                          <Database size={24} />
                        </Box>
                        <Text fontWeight="bold">No records found</Text>
                        <Text color="gray.500" fontSize="sm">
                          Ubah filter atau tambahkan data baru.
                        </Text>
                      </VStack>
                    ) : (
                      <Box className="table-wrap">
                        <table className="data-table">
                          <thead>
                            <tr>
                              {cfg?.crud && (
                                <th>
                                  <input
                                    aria-label="Select all rows"
                                    type="checkbox"
                                    checked={
                                      rows.length > 0 &&
                                      rows.every((r) =>
                                        selectedRows.includes(rowKey(r)),
                                      )
                                    }
                                    onChange={(e) =>
                                      setSelectedRows(
                                        e.target.checked
                                          ? rows.map(rowKey)
                                          : [],
                                      )
                                    }
                                  />
                                </th>
                              )}
                              {columns.map((c) => (
                                <th key={c}>{title(c)}</th>
                              ))}
                              <th style={{ textAlign: "right" }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r, i) => (
                              <tr key={rowKey(r) || i}>
                                {cfg?.crud && (
                                  <td>
                                    <input
                                      aria-label={`Select ${r.code}`}
                                      type="checkbox"
                                      checked={selectedRows.includes(rowKey(r))}
                                      onChange={(e) =>
                                        setSelectedRows((prev) =>
                                          e.target.checked
                                            ? [...new Set([...prev, rowKey(r)])]
                                            : prev.filter(
                                                (key) => key !== rowKey(r),
                                              ),
                                        )
                                      }
                                    />
                                  </td>
                                )}
                                {columns.map((c) => (
                                  <td key={c}>{cell(r, c)}</td>
                                ))}
                                <td>
                                  <HStack justify="end" spacing={1}>
                                    {active === "products" && (
                                      <Tooltip label="View product suppliers">
                                        <IconButton
                                          aria-label="View suppliers"
                                          size="sm"
                                          variant="ghost"
                                          colorScheme="red"
                                          icon={<Eye size={15} />}
                                          onClick={() =>
                                            openProductSuppliers(r)
                                          }
                                        />
                                      </Tooltip>
                                    )}
                                    {cfg?.crud && (
                                      <>
                                        <Tooltip label="Update">
                                          <IconButton
                                            aria-label="Update"
                                            size="sm"
                                            variant="ghost"
                                            icon={<Pencil size={15} />}
                                            onClick={() => openEdit(r)}
                                          />
                                        </Tooltip>
                                        <Tooltip label="Delete">
                                          <IconButton
                                            aria-label="Delete"
                                            size="sm"
                                            isLoading={
                                              deletingKey === rowKey(r)
                                            }
                                            isDisabled={
                                              !!deletingKey &&
                                              deletingKey !== rowKey(r)
                                            }
                                            variant="ghost"
                                            colorScheme="red"
                                            icon={<Trash2 size={15} />}
                                            onClick={() => remove(r)}
                                          />
                                        </Tooltip>
                                      </>
                                    )}
                                  </HStack>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </Box>
                    )}
                  </Box>
                </>
              )}
            </Stack>
          )}
        </Container>
      </Box>
      <Modal
        isOpen={importModal.isOpen}
        onClose={importModal.onClose}
        isCentered
      >
        <ModalOverlay />
        <ModalContent bg={dark ? "gray.900" : "white"}>
          <ModalHeader>
            Import {importSource === "otomax" ? "from Otomax" : "Excel"}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <Alert status="info" rounded="md">
                <AlertIcon />
                {
                  "Import hanya menggunakan mode Insert. Data duplikat akan dilaporkan sebagai gagal."
                }
              </Alert>
              <FormControl>
                <FormLabel>Pilih file Excel (.xlsx / .xls)</FormLabel>
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  p={1}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void importExcel(file);
                    e.currentTarget.value = "";
                  }}
                />
              </FormControl>
              {importSource === "otomax" && (
                <Text fontSize="xs" color="gray.500">
                  Header Otomax:{" "}
                  {active === "products"
                    ? "Kode, Provider, Nama"
                    : "Produk, Modul, Perintah"}
                </Text>
              )}
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={importModal.onClose}>
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Modal isOpen={modal.isOpen} onClose={modal.onClose} isCentered size="lg">
        <ModalOverlay />
        <ModalContent bg={dark ? "gray.900" : "white"}>
          <ModalHeader>
            {editing ? "Update" : "Create"} {formCfg?.title}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              {formCfg?.fields.map((f) => (
                <FormControl key={f.name} isRequired={f.required}>
                  <FormLabel fontSize="sm">{f.label}</FormLabel>
                  {f.fk &&
                  !(
                    (mappingMode || active === "product-suppliers") &&
                    f.name === "productCode"
                  ) ? (
                    <RelationCombobox
                      placeholder={`Select ${f.label}`}
                      value={form[f.name] || ""}
                      options={options[f.fk] || []}
                      onChange={(value) =>
                        setForm((p: Row) => ({ ...p, [f.name]: value }))
                      }
                    />
                  ) : (
                    <Input
                      type={f.url ? "url" : "text"}
                      maxLength={
                        f.name === "productCode"
                          ? undefined
                          : f.name === "name"
                            ? 64
                            : f.name === "supplierProductCode"
                              ? 500
                              : f.name === "productListUrl"
                                ? 500
                                : 16
                      }
                      value={form[f.name] ?? ""}
                      onChange={(e) =>
                        setForm((p: Row) => ({
                          ...p,
                          [f.name]: e.target.value,
                        }))
                      }
                      placeholder={`Enter ${f.label.toLowerCase()}`}
                    />
                  )}
                </FormControl>
              ))}
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              mr={3}
              onClick={modal.onClose}
              isDisabled={saving}
            >
              Cancel
            </Button>
            <Button
              colorScheme="brand"
              onClick={save}
              isLoading={saving}
              loadingText={editing ? "Saving..." : "Creating..."}
              isDisabled={saving}
            >
              {editing ? "Save changes" : "Create record"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Modal
        isOpen={detail.isOpen}
        onClose={detail.onClose}
        size="6xl"
        scrollBehavior="inside"
      >
        <ModalOverlay />
        <ModalContent bg={dark ? "gray.900" : "white"}>
          <ModalHeader>
            <HStack>
              <Box>
                <Text>Product suppliers</Text>
                <Text fontSize="xs" color="gray.500" fontWeight="normal">
                  {detailProduct?.code} · {detailProduct?.name}
                </Text>
              </Box>
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {detailLoading ? (
              <Stack>
                <Skeleton h="20px" />
                <SkeletonText noOfLines={4} />
              </Stack>
            ) : !detailRows.length ? (
              <Text py={8} textAlign="center" color="gray.500">
                Belum ada supplier untuk produk ini.
              </Text>
            ) : (
              <Box className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      {[
                        "Supplier",
                        "Supplier product code",
                        "Title",
                        "Status",
                        "Price",
                        "Updated",
                      ].map((x) => (
                        <th key={x}>{x}</th>
                      ))}
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows.map((r, i) => (
                      <tr key={r.supplierCode + i}>
                        <td>{r.supplierCode}</td>
                        <td>{r.supplierProductCode}</td>
                        <td>{r.title || "—"}</td>
                        <td>{cell(r, "status")}</td>
                        <td>{money(r.price)}</td>
                        <td>{date(r.updatedAt)}</td>
                        <td>
                          <HStack>
                            <IconButton
                              aria-label="Edit mapping"
                              size="sm"
                              icon={<Pencil size={14} />}
                              variant="ghost"
                              onClick={() => void openMappingForm(r)}
                              isLoading={mappingOpening}
                              isDisabled={mappingOpening}
                            />
                            <IconButton
                              aria-label="Delete mapping"
                              size="sm"
                              isLoading={
                                deletingKey ===
                                `${r.productCode}|${r.supplierCode}|${r.supplierProductCode}`
                              }
                              isDisabled={
                                !!deletingKey &&
                                deletingKey !==
                                  `${r.productCode}|${r.supplierCode}|${r.supplierProductCode}`
                              }
                              icon={<Trash2 size={14} />}
                              variant="ghost"
                              colorScheme="red"
                              onClick={() => remove(r, true)}
                            />
                          </HStack>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Flex>
  );
}
