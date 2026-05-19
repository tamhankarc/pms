"use client";


import { AutoSubmitFilterForm } from "@/components/forms/auto-submit-filter-form";
import { useMemo, useState } from "react";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import type { AmazonBillingReportData, AmazonReportType } from "@/lib/billing-reports/amazon";

type OptionWithMovies = {
  id: string;
  name: string;
  movieIds?: string[];
};

type Props = {
  clientId: string;
  reportType: AmazonReportType;
  data: AmazonBillingReportData;
};

function optionIsValidForMovie(option: OptionWithMovies, movieId: string) {
  if (movieId === "all") return true;
  return option.movieIds?.includes(movieId) ?? false;
}

export function UniversalTimeEntryFilters({ clientId, reportType, data }: Props) {
  const [movieId, setMovieId] = useState(data.filters.movieId || "all");
  const [assetNameId, setAssetNameId] = useState(data.filters.assetNameId || "all");
  const [countryId, setCountryId] = useState(data.filters.countryId || "all");

  const assetNameOptions = useMemo(
    () => data.assetTypeOptions.filter((option) => optionIsValidForMovie(option, movieId)),
    [data.assetTypeOptions, movieId],
  );

  const countryOptions = useMemo(
    () => data.countryOptions.filter((option) => optionIsValidForMovie(option, movieId)),
    [data.countryOptions, movieId],
  );

  function handleMovieChange(nextMovieId: string) {
    setMovieId(nextMovieId);

    const nextAssetNameOptions = data.assetTypeOptions.filter((option) => optionIsValidForMovie(option, nextMovieId));
    if (assetNameId !== "all" && !nextAssetNameOptions.some((option) => option.id === assetNameId)) {
      setAssetNameId("all");
    }

    const nextCountryOptions = data.countryOptions.filter((option) => optionIsValidForMovie(option, nextMovieId));
    if (countryId !== "all" && !nextCountryOptions.some((option) => option.id === countryId)) {
      setCountryId("all");
    }
  }

  const isLocalization = reportType === "localization";

  return (
    <AutoSubmitFilterForm method="get" action={`/billing-reports/${clientId}`} className="card p-5">
      <input type="hidden" name="report" value={reportType} />
      <div className={isLocalization ? "grid gap-4 md:grid-cols-[150px_150px_1fr_1fr_1fr_auto] md:items-end" : "grid gap-4 md:grid-cols-[160px_160px_1fr_1fr_auto] md:items-end"}>
        <div>
          <label className="label" htmlFor="fromDate">Date from</label>
          <input id="fromDate" name="fromDate" type="date" className="input" defaultValue={data.filters.fromDate} />
        </div>
        <div>
          <label className="label" htmlFor="toDate">Date to</label>
          <input id="toDate" name="toDate" type="date" className="input" defaultValue={data.filters.toDate} />
        </div>
        <div>
          <label className="label" htmlFor="movieId">Title</label>
          <SearchableCombobox
            id="movieId"
            name="movieId"
            value={movieId}
            onValueChange={handleMovieChange}
            options={[{ value: "all", label: "All titles" }, ...data.movieOptions.map((movie) => ({ value: movie.id, label: movie.title }))]}
            placeholder="All titles"
            searchPlaceholder="Search titles..."
            emptyLabel="No titles found."
          />
        </div>
        <div>
          <label className="label" htmlFor="assetNameId">Asset Name</label>
          <SearchableCombobox
            id="assetNameId"
            name="assetNameId"
            value={assetNameId}
            onValueChange={setAssetNameId}
            options={[{ value: "all", label: "All asset names" }, ...assetNameOptions.map((assetName) => ({ value: assetName.id, label: assetName.name }))]}
            placeholder="All asset names"
            searchPlaceholder="Search asset names..."
            emptyLabel="No asset names found."
          />
        </div>
        {isLocalization ? (
          <div>
            <label className="label" htmlFor="countryId">Territory/Variant</label>
            <SearchableCombobox
              id="countryId"
              name="countryId"
              value={countryId}
              onValueChange={setCountryId}
              options={[{ value: "all", label: "All territories/variants" }, ...countryOptions.map((country) => ({ value: country.id, label: country.name }))]}
              placeholder="All territories/variants"
              searchPlaceholder="Search territories/variants..."
              emptyLabel="No territories/variants found."
            />
          </div>
        ) : null}
      </div>
    </AutoSubmitFilterForm>
  );
}
