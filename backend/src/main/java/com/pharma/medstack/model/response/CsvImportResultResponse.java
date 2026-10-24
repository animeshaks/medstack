package com.pharma.medstack.model.response;

import java.util.List;

public record CsvImportResultResponse(
    int totalRows,
    int importedCount,
    int errorCount,
    List<CsvRowError> errors
) {
    public record CsvRowError(
        int row,
        String field,
        String message,
        String rowData
    ) {}
}
