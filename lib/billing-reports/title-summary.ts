import {
  getWarnerDomesticDeliverableData,
  getWarnerIntlDeliverableData,
  getWarnerOtherDeliverableData,
  type WarnerDomesticDeliverableData,
} from "@/lib/billing-reports/amazon";
import {
  getSonyPicturesReportData,
  type SonyPicturesReportData,
} from "@/lib/billing-reports/sony";

export type ClientTitleSummaryFilters = {
  movieId: string;
};

export type ClientTitleSummaryRow = {
  label: string;
  meta?: string;
  cost: number;
};

export type ClientTitleSummaryReportBlock = {
  reportType: string;
  reportTitle: string;
  rows: ClientTitleSummaryRow[];
  totalCost: number;
};

export type ClientTitleSummaryTitleBlock = {
  movie: { id: string; title: string; status?: string };
  contactPersons: Array<{
    id?: string;
    name: string;
    email?: string | null;
    countryCode?: string | null;
    country?: { isoCode?: string | null } | null;
  }>;
  blocks: ClientTitleSummaryReportBlock[];
  totalCost: number;
};

export type ClientTitleSummaryData = {
  client: { id: string; name: string };
  reportTitle: string;
  filters: ClientTitleSummaryFilters;
  movieOptions: { id: string; title: string; status?: string }[];
  titleBlocks: ClientTitleSummaryTitleBlock[];
};

function getParamValue(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string,
) {
  if (searchParams instanceof URLSearchParams)
    return searchParams.get(key) ?? undefined;
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

export function buildClientTitleSummaryFilters(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
) {
  return {
    movieId: getParamValue(searchParams, "movieId") || "all",
  } satisfies ClientTitleSummaryFilters;
}

function addMovieOption(
  options: Map<string, { id: string; title: string; status?: string }>,
  movie: { id: string; title: string; status?: string },
) {
  if (!options.has(movie.id)) options.set(movie.id, movie);
}

function mergeTitleBlock(
  blocks: Map<string, ClientTitleSummaryTitleBlock>,
  movie: { id: string; title: string; status?: string },
  contactPersons: ClientTitleSummaryTitleBlock["contactPersons"],
  reportBlock: ClientTitleSummaryReportBlock,
) {
  if (!reportBlock.rows.length) return;
  const existing = blocks.get(movie.id) ?? {
    movie,
    contactPersons,
    blocks: [],
    totalCost: 0,
  };
  existing.blocks.push(reportBlock);
  existing.totalCost += reportBlock.totalCost;
  if (!existing.contactPersons.length && contactPersons.length) {
    existing.contactPersons = contactPersons;
  }
  blocks.set(movie.id, existing);
}

function addWarnerData(
  titleBlocks: Map<string, ClientTitleSummaryTitleBlock>,
  movieOptions: Map<string, { id: string; title: string; status?: string }>,
  data: WarnerDomesticDeliverableData | null,
) {
  if (!data) return;
  for (const movie of data.movieOptions) addMovieOption(movieOptions, movie);

  if (data.titleBlocks?.length) {
    for (const block of data.titleBlocks) {
      mergeTitleBlock(
        titleBlocks,
        block.selectedMovie,
        block.selectedMovie.contactPersons ?? [],
        {
          reportType: data.reportType,
          reportTitle: data.reportTitle,
          rows: block.rows.map((row) => ({
            label: row.label,
            meta: row.meta,
            cost: row.cost,
          })),
          totalCost: block.totalCost,
        },
      );
    }
    return;
  }

  if (data.selectedMovie && data.rows.length) {
    mergeTitleBlock(
      titleBlocks,
      data.selectedMovie,
      data.selectedMovie.contactPersons ?? [],
      {
        reportType: data.reportType,
        reportTitle: data.reportTitle,
        rows: data.rows.map((row) => ({
          label: row.label,
          meta: row.meta,
          cost: row.cost,
        })),
        totalCost: data.totalCost,
      },
    );
  }
}

function getSonyRows(data: SonyPicturesReportData) {
  return [
    ...data.projectRows.map((row) => ({
      label: row.projectName,
      meta: row.lensDetails?.length
        ? `Lens Type / Countries: ${row.lensDetails.join("; ")}`
        : row.countryList
          ? `Countries: ${row.countryList}`
          : undefined,
      cost: row.cost,
    })),
    ...data.chargeRows.map((row) => ({
      label: row.label,
      meta: "Title Charges",
      cost: row.cost,
    })),
  ];
}

function addSonyData(
  titleBlocks: Map<string, ClientTitleSummaryTitleBlock>,
  movieOptions: Map<string, { id: string; title: string; status?: string }>,
  data: SonyPicturesReportData | null,
  reportType: string,
) {
  if (!data) return;
  for (const movie of data.movieOptions) addMovieOption(movieOptions, movie);

  if (data.titleBlocks.length) {
    for (const block of data.titleBlocks) {
      const rows = [
        ...block.projectRows.map((row) => ({
          label: row.projectName,
          meta: row.lensDetails?.length
            ? `Lens Type / Countries: ${row.lensDetails.join("; ")}`
            : row.countryList
              ? `Countries: ${row.countryList}`
              : undefined,
          cost: row.cost,
        })),
        ...block.chargeRows.map((row) => ({
          label: row.label,
          meta: "Title Charges",
          cost: row.cost,
        })),
      ];
      mergeTitleBlock(titleBlocks, block.movie, block.contactPersons, {
        reportType,
        reportTitle: data.reportTitle,
        rows,
        totalCost: block.totalCost,
      });
    }
    return;
  }

  if (data.selectedMovie) {
    const rows = getSonyRows(data);
    mergeTitleBlock(titleBlocks, data.selectedMovie, data.contactPersons, {
      reportType,
      reportTitle: data.reportTitle,
      rows,
      totalCost: data.totalCost,
    });
  }
}

export async function getWarnerTitleSummaryData({
  clientId,
  filters,
}: {
  clientId: string;
  filters: ClientTitleSummaryFilters;
}): Promise<ClientTitleSummaryData | null> {
  const [domestic, intl, other] = await Promise.all([
    getWarnerDomesticDeliverableData({ clientId, filters: { movieId: filters.movieId, countryId: "" } }),
    getWarnerIntlDeliverableData({ clientId, filters: { movieId: filters.movieId, countryId: "" } }),
    getWarnerOtherDeliverableData({ clientId, filters: { movieId: filters.movieId, countryId: "" } }),
  ]);
  const client = domestic?.client ?? intl?.client ?? other?.client;
  if (!client) return null;

  const titleBlocks = new Map<string, ClientTitleSummaryTitleBlock>();
  const movieOptions = new Map<string, { id: string; title: string; status?: string }>();
  addWarnerData(titleBlocks, movieOptions, domestic);
  addWarnerData(titleBlocks, movieOptions, intl);
  addWarnerData(titleBlocks, movieOptions, other);

  return {
    client: { id: client.id, name: client.name },
    reportTitle: "Title Summary",
    filters,
    movieOptions: Array.from(movieOptions.values()).sort((a, b) =>
      a.title.localeCompare(b.title),
    ),
    titleBlocks: Array.from(titleBlocks.values()).sort((a, b) =>
      a.movie.title.localeCompare(b.movie.title),
    ),
  };
}

export async function getSonyTitleSummaryData({
  clientId,
  filters,
}: {
  clientId: string;
  filters: ClientTitleSummaryFilters;
}): Promise<ClientTitleSummaryData | null> {
  const [speMain, canadaOther] = await Promise.all([
    getSonyPicturesReportData({ clientId, filters, variant: "main" }),
    getSonyPicturesReportData({ clientId, filters, variant: "canada-other" }),
  ]);
  const client = speMain?.client ?? canadaOther?.client;
  if (!client) return null;

  const titleBlocks = new Map<string, ClientTitleSummaryTitleBlock>();
  const movieOptions = new Map<string, { id: string; title: string; status?: string }>();
  addSonyData(titleBlocks, movieOptions, speMain, "spe-main");
  addSonyData(titleBlocks, movieOptions, canadaOther, "canada-other");

  return {
    client: { id: client.id, name: client.name },
    reportTitle: "Title Summary",
    filters,
    movieOptions: Array.from(movieOptions.values()).sort((a, b) =>
      a.title.localeCompare(b.title),
    ),
    titleBlocks: Array.from(titleBlocks.values()).sort((a, b) =>
      a.movie.title.localeCompare(b.movie.title),
    ),
  };
}

export function getClientTitleSummaryFileName(
  data: ClientTitleSummaryData,
  extension: "xlsx" | "pdf",
) {
  const safeClientName = data.client.name.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "Client";
  return `${safeClientName}_Title_Summary.${extension}`;
}
