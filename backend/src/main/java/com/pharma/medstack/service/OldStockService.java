package com.pharma.medstack.service;

import com.pharma.medstack.entity.InventoryBatch;
import com.pharma.medstack.entity.Medicine;
import com.pharma.medstack.exception.BusinessValidationException;
import com.pharma.medstack.exception.ResourceNotFoundException;
import com.pharma.medstack.model.request.OldStockRequest;
import com.pharma.medstack.model.response.CsvImportResultResponse;
import com.pharma.medstack.model.response.InventoryBatchResponse;
import com.pharma.medstack.model.response.OldStockSummaryResponse;
import com.pharma.medstack.repository.InventoryBatchRepository;
import com.pharma.medstack.repository.MedicineRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class OldStockService {

    private final InventoryBatchRepository inventoryBatchRepository;
    private final MedicineRepository medicineRepository;

    @Transactional(readOnly = true)
    public Page<InventoryBatchResponse> getOldStockBatches(String search, String status, Pageable pageable) {
        if (search != null && !search.trim().isEmpty()) {
            return inventoryBatchRepository.searchOldStock(search.trim(), pageable)
                    .map(InventoryService::mapToResponse);
        }
        if ("ACTIVE".equalsIgnoreCase(status)) {
            return inventoryBatchRepository.findActiveOldStock(pageable)
                    .map(InventoryService::mapToResponse);
        }
        if ("CLEARED".equalsIgnoreCase(status)) {
            return inventoryBatchRepository.findClearedOldStock(pageable)
                    .map(InventoryService::mapToResponse);
        }
        return inventoryBatchRepository.findAllOldStock(pageable)
                .map(InventoryService::mapToResponse);
    }

    @Transactional(readOnly = true)
    public OldStockSummaryResponse getOldStockSummary() {
        long total = inventoryBatchRepository.countAllOldStock();
        long active = inventoryBatchRepository.countActiveOldStock();
        long cleared = inventoryBatchRepository.countClearedOldStock();
        long remainingUnits = inventoryBatchRepository.sumRemainingOldStockUnits();
        BigDecimal costVal = inventoryBatchRepository.sumRemainingOldStockCostValue();
        BigDecimal mrpVal = inventoryBatchRepository.sumRemainingOldStockMrpValue();

        return new OldStockSummaryResponse(
                total,
                active,
                cleared,
                remainingUnits,
                costVal != null ? costVal : BigDecimal.ZERO,
                mrpVal != null ? mrpVal : BigDecimal.ZERO
        );
    }

    @Transactional
    public InventoryBatchResponse addOldStock(OldStockRequest request, String username) {
        if (request.sellingPrice().compareTo(request.mrp()) > 0) {
            throw new BusinessValidationException("Selling price (" + request.sellingPrice() + ") cannot exceed MRP (" + request.mrp() + ")");
        }

        Medicine medicine = resolveOrCreateMedicine(request);

        String batchNumber = request.batchNumber().trim().toUpperCase();
        Optional<InventoryBatch> existingOpt = inventoryBatchRepository
                .findByMedicineIdAndBatchNumberAndIsDeletedFalse(medicine.getId(), batchNumber);

        InventoryBatch batch;
        if (existingOpt.isPresent()) {
            batch = existingOpt.get();
            batch.setQuantity(batch.getQuantity() + request.quantity());
            if (request.looseQuantity() != null && request.looseQuantity() > 0) {
                batch.setLooseQuantity(batch.getLooseQuantity() + request.looseQuantity());
            }
            batch.setMrp(request.mrp());
            batch.setSellingPrice(request.sellingPrice());
            if (request.costPrice() != null) {
                batch.setCostPrice(request.costPrice());
            }
            batch.setExpiryDate(request.expiryDate());
            batch.setOldStock(true);
            batch.setStockSource("OPENING_STOCK");
            if (request.stockNotes() != null && !request.stockNotes().trim().isEmpty()) {
                batch.setStockNotes(request.stockNotes().trim());
            }
        } else {
            BigDecimal costPrice = request.costPrice() != null ? request.costPrice() : request.mrp();
            batch = InventoryBatch.builder()
                    .medicine(medicine)
                    .batchNumber(batchNumber)
                    .expiryDate(request.expiryDate())
                    .mrp(request.mrp())
                    .costPrice(costPrice)
                    .sellingPrice(request.sellingPrice())
                    .quantity(request.quantity())
                    .looseQuantity(request.looseQuantity() != null ? request.looseQuantity() : 0)
                    .isRetired(false)
                    .isOldStock(true)
                    .stockSource("OPENING_STOCK")
                    .stockNotes(request.stockNotes())
                    .build();
        }

        batch = inventoryBatchRepository.save(batch);
        log.info("OLD_STOCK_ADDED batchId={} medicine={} batchNo={} qty={} user={}",
                batch.getId(), medicine.getName(), batch.getBatchNumber(), batch.getQuantity(), username);

        return InventoryService.mapToResponse(batch);
    }

    @Transactional
    public InventoryBatchResponse updateOldStock(UUID batchId, OldStockRequest request, String username) {
        InventoryBatch batch = inventoryBatchRepository.findById(batchId)
                .filter(b -> !b.isDeleted())
                .orElseThrow(() -> new ResourceNotFoundException("Opening stock batch not found with id: " + batchId));

        if (request.sellingPrice().compareTo(request.mrp()) > 0) {
            throw new BusinessValidationException("Selling price (" + request.sellingPrice() + ") cannot exceed MRP (" + request.mrp() + ")");
        }

        batch.setBatchNumber(request.batchNumber().trim().toUpperCase());
        batch.setExpiryDate(request.expiryDate());
        batch.setMrp(request.mrp());
        batch.setSellingPrice(request.sellingPrice());
        if (request.costPrice() != null) {
            batch.setCostPrice(request.costPrice());
        }
        batch.setQuantity(request.quantity());
        if (request.looseQuantity() != null) {
            batch.setLooseQuantity(request.looseQuantity());
        }
        if (request.stockNotes() != null) {
            batch.setStockNotes(request.stockNotes().trim());
        }

        Medicine medicine = batch.getMedicine();
        if (request.rackLocation() != null && !request.rackLocation().trim().isEmpty()) {
            medicine.setRackLocation(request.rackLocation().trim());
            medicineRepository.save(medicine);
        }

        batch = inventoryBatchRepository.save(batch);
        log.info("OLD_STOCK_UPDATED batchId={} user={}", batchId, username);

        return InventoryService.mapToResponse(batch);
    }

    @Transactional
    public void deleteOldStock(UUID batchId, String username) {
        InventoryBatch batch = inventoryBatchRepository.findById(batchId)
                .filter(b -> !b.isDeleted())
                .orElseThrow(() -> new ResourceNotFoundException("Opening stock batch not found with id: " + batchId));

        batch.setDeleted(true);
        batch.setRetired(true);
        inventoryBatchRepository.save(batch);
        log.info("OLD_STOCK_DELETED batchId={} user={}", batchId, username);
    }

    @Transactional
    public CsvImportResultResponse importOldStockCsv(InputStream inputStream, String username) {
        List<CsvImportResultResponse.CsvRowError> errors = new ArrayList<>();
        List<OldStockRequest> validRequests = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
            String line;
            int lineNumber = 0;
            Map<String, Integer> headerMap = null;

            while ((line = reader.readLine()) != null) {
                lineNumber++;
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                    continue; // Skip comments and blank lines
                }

                List<String> tokens = parseCsvLine(trimmed);
                if (headerMap == null) {
                    headerMap = new HashMap<>();
                    for (int i = 0; i < tokens.size(); i++) {
                        String col = tokens.get(i).toLowerCase().replace("*", "").replace(" ", "_").trim();
                        headerMap.put(col, i);
                    }
                    continue;
                }

                // Process data row
                String medicineName = getColValue(tokens, headerMap, "medicine_name", "item_name", "name");
                String batchNumber = getColValue(tokens, headerMap, "batch_number", "batch_no", "batch");
                String expiryStr = getColValue(tokens, headerMap, "expiry_date", "expiry", "exp_date");
                String qtyStr = getColValue(tokens, headerMap, "quantity", "qty", "packs");
                String mrpStr = getColValue(tokens, headerMap, "mrp");
                String sellingPriceStr = getColValue(tokens, headerMap, "selling_price", "sale_price", "rate");

                // Validate Mandatory Columns
                if (medicineName == null || medicineName.isEmpty()) {
                    errors.add(new CsvImportResultResponse.CsvRowError(lineNumber, "medicine_name", "Medicine Name is mandatory", trimmed));
                    continue;
                }
                if (batchNumber == null || batchNumber.isEmpty()) {
                    errors.add(new CsvImportResultResponse.CsvRowError(lineNumber, "batch_number", "Batch Number is mandatory", trimmed));
                    continue;
                }
                if (expiryStr == null || expiryStr.isEmpty()) {
                    errors.add(new CsvImportResultResponse.CsvRowError(lineNumber, "expiry_date", "Expiry Date is mandatory (Format: YYYY-MM-DD or MM/YYYY)", trimmed));
                    continue;
                }
                LocalDate expiryDate = parseExpiryDate(expiryStr);
                if (expiryDate == null) {
                    errors.add(new CsvImportResultResponse.CsvRowError(lineNumber, "expiry_date", "Invalid date format '" + expiryStr + "'. Expected YYYY-MM-DD or MM/YYYY or DD/MM/YYYY", trimmed));
                    continue;
                }

                if (qtyStr == null || qtyStr.isEmpty()) {
                    errors.add(new CsvImportResultResponse.CsvRowError(lineNumber, "quantity", "Quantity is mandatory", trimmed));
                    continue;
                }
                int quantity;
                try {
                    quantity = Integer.parseInt(qtyStr.replace(",", ""));
                    if (quantity < 0) {
                        errors.add(new CsvImportResultResponse.CsvRowError(lineNumber, "quantity", "Quantity cannot be negative", trimmed));
                        continue;
                    }
                } catch (NumberFormatException e) {
                    errors.add(new CsvImportResultResponse.CsvRowError(lineNumber, "quantity", "Invalid quantity number '" + qtyStr + "'", trimmed));
                    continue;
                }

                if (mrpStr == null || mrpStr.isEmpty()) {
                    errors.add(new CsvImportResultResponse.CsvRowError(lineNumber, "mrp", "MRP is mandatory", trimmed));
                    continue;
                }
                BigDecimal mrp;
                try {
                    mrp = new BigDecimal(mrpStr.replace(",", "").replace("₹", "").trim());
                    if (mrp.compareTo(BigDecimal.ZERO) <= 0) {
                        errors.add(new CsvImportResultResponse.CsvRowError(lineNumber, "mrp", "MRP must be greater than 0", trimmed));
                        continue;
                    }
                } catch (Exception e) {
                    errors.add(new CsvImportResultResponse.CsvRowError(lineNumber, "mrp", "Invalid MRP number '" + mrpStr + "'", trimmed));
                    continue;
                }

                BigDecimal sellingPrice;
                if (sellingPriceStr != null && !sellingPriceStr.isEmpty()) {
                    try {
                        sellingPrice = new BigDecimal(sellingPriceStr.replace(",", "").replace("₹", "").trim());
                        if (sellingPrice.compareTo(BigDecimal.ZERO) <= 0) {
                            errors.add(new CsvImportResultResponse.CsvRowError(lineNumber, "selling_price", "Selling price must be greater than 0", trimmed));
                            continue;
                        }
                    } catch (Exception e) {
                        errors.add(new CsvImportResultResponse.CsvRowError(lineNumber, "selling_price", "Invalid selling price number '" + sellingPriceStr + "'", trimmed));
                        continue;
                    }
                } else {
                    sellingPrice = mrp; // Default to MRP if not specified
                }

                if (sellingPrice.compareTo(mrp) > 0) {
                    errors.add(new CsvImportResultResponse.CsvRowError(lineNumber, "selling_price", "Selling price (" + sellingPrice + ") cannot exceed MRP (" + mrp + ")", trimmed));
                    continue;
                }

                // Optional Columns
                String costStr = getColValue(tokens, headerMap, "cost_price", "purchase_price", "cost");
                BigDecimal costPrice = null;
                if (costStr != null && !costStr.isEmpty()) {
                    try {
                        costPrice = new BigDecimal(costStr.replace(",", "").replace("₹", "").trim());
                    } catch (Exception ignored) {}
                }
                if (costPrice == null) costPrice = mrp;

                String genericName = getColValue(tokens, headerMap, "generic_name", "generic", "composition");
                String category = getColValue(tokens, headerMap, "category", "type");
                String manufacturer = getColValue(tokens, headerMap, "manufacturer", "mfg", "brand");
                String hsnCode = getColValue(tokens, headerMap, "hsn_code", "hsn");
                String rackLocation = getColValue(tokens, headerMap, "rack_location", "rack", "shelf");

                String gstStr = getColValue(tokens, headerMap, "gst_rate", "gst", "tax");
                BigDecimal gstRate = new BigDecimal("5.00");
                if (gstStr != null && !gstStr.isEmpty()) {
                    try {
                        gstRate = new BigDecimal(gstStr.replace("%", "").trim());
                    } catch (Exception ignored) {}
                }

                String unitsStr = getColValue(tokens, headerMap, "units_per_pack", "pack_size", "units");
                int unitsPerPack = 1;
                if (unitsStr != null && !unitsStr.isEmpty()) {
                    try {
                        unitsPerPack = Math.max(1, Integer.parseInt(unitsStr.trim()));
                    } catch (Exception ignored) {}
                }

                String looseStr = getColValue(tokens, headerMap, "loose_quantity", "loose_qty", "loose");
                int looseQty = 0;
                if (looseStr != null && !looseStr.isEmpty()) {
                    try {
                        looseQty = Math.max(0, Integer.parseInt(looseStr.trim()));
                    } catch (Exception ignored) {}
                }

                String rxStr = getColValue(tokens, headerMap, "requires_prescription", "prescription_required", "rx");
                boolean rxRequired = false;
                if (rxStr != null && !rxStr.isEmpty()) {
                    rxRequired = "true".equalsIgnoreCase(rxStr) || "yes".equalsIgnoreCase(rxStr) || "1".equals(rxStr);
                }

                String minAlertStr = getColValue(tokens, headerMap, "min_stock_alert_level", "min_stock", "alert_level");
                int minStockAlert = 10;
                if (minAlertStr != null && !minAlertStr.isEmpty()) {
                    try {
                        minStockAlert = Math.max(0, Integer.parseInt(minAlertStr.trim()));
                    } catch (Exception ignored) {}
                }

                String stockNotes = getColValue(tokens, headerMap, "stock_notes", "notes", "remarks");

                validRequests.add(new OldStockRequest(
                        null,
                        medicineName,
                        genericName,
                        category,
                        manufacturer,
                        hsnCode,
                        rackLocation,
                        batchNumber,
                        expiryDate,
                        mrp,
                        costPrice,
                        sellingPrice,
                        quantity,
                        looseQty,
                        unitsPerPack,
                        gstRate,
                        rxRequired,
                        minStockAlert,
                        stockNotes
                ));
            }

            int totalRows = validRequests.size() + errors.size();

            // If there are row-level validation errors, do not commit; return errors so user can fix them!
            if (!errors.isEmpty()) {
                log.warn("OLD_STOCK_CSV_IMPORT_FAILED user={} totalRows={} errorCount={}", username, totalRows, errors.size());
                return new CsvImportResultResponse(totalRows, 0, errors.size(), errors);
            }

            // All valid - save atomically
            for (OldStockRequest req : validRequests) {
                addOldStock(req, username);
            }

            log.info("OLD_STOCK_CSV_IMPORT_SUCCESS user={} importedCount={}", username, validRequests.size());
            return new CsvImportResultResponse(totalRows, validRequests.size(), 0, Collections.emptyList());

        } catch (Exception e) {
            log.error("Failed to process CSV file", e);
            errors.add(new CsvImportResultResponse.CsvRowError(0, "file", "Failed to parse CSV file: " + e.getMessage(), ""));
            return new CsvImportResultResponse(0, 0, errors.size(), errors);
        }
    }

    public String generateCsvTemplate() {
        return """
# =========================================================================================
# MedStack - Opening / Old Stock CSV Import Template
# =========================================================================================
# INSTRUCTIONS FOR PHARMACY STORE OPERATORS:
# 1. Columns marked with * are MANDATORY: medicine_name, batch_number, expiry_date, quantity, mrp, selling_price.
# 2. Expiry date accepted formats: YYYY-MM-DD (e.g. 2027-12-31) or MM/YYYY (e.g. 12/2027) or DD/MM/YYYY.
# 3. Selling price must be less than or equal to MRP.
# 4. If medicine does not exist in store, MedStack will automatically create it.
# 5. Lines starting with # are comments and will be ignored by the system.
# =========================================================================================
medicine_name*,batch_number*,expiry_date*,quantity*,mrp*,selling_price*,cost_price,generic_name,category,manufacturer,rack_location,gst_rate,units_per_pack,loose_quantity,requires_prescription,min_stock_alert_level,stock_notes
Paracetamol 650,B1024,2027-12-31,50,30.00,28.00,22.00,Paracetamol,Fever / Pain,Cipla,Rack A-1,5.00,10,0,FALSE,10,Opening stock from shelf A1
Amoxicillin 500mg,AMX-99,06/2027,20,85.00,80.00,65.00,Amoxicillin,Antibiotic,Sun Pharma,Rack B-2,5.00,10,0,TRUE,5,Old stock shelf 2
Durex Extra Thin,DUR-01,2028-01-31,15,150.00,150.00,120.00,Condom,Contraceptive,Reckitt,Rack C-3,0.00,3,0,FALSE,5,Legacy store inventory
Azithromycin 500,AZI-44,2026-11-30,30,120.00,115.00,90.00,Azithromycin,Antibiotic,Zydus,Rack A-3,5.00,3,0,TRUE,10,Old batch
""";
    }

    private Medicine resolveOrCreateMedicine(OldStockRequest request) {
        if (request.medicineId() != null) {
            return medicineRepository.findByIdAndIsDeletedFalse(request.medicineId())
                    .orElseThrow(() -> new ResourceNotFoundException("Medicine not found with id: " + request.medicineId()));
        }

        String name = request.medicineName().trim();
        Optional<Medicine> existingOpt = medicineRepository.findByNameIgnoreCaseAndIsDeletedFalse(name);
        if (existingOpt.isPresent()) {
            Medicine med = existingOpt.get();
            if (request.rackLocation() != null && !request.rackLocation().trim().isEmpty() &&
                    (med.getRackLocation() == null || med.getRackLocation().isEmpty())) {
                med.setRackLocation(request.rackLocation().trim());
                med = medicineRepository.save(med);
            }
            return med;
        }

        Medicine med = new Medicine();
        med.setName(name);
        med.setGenericName(request.genericName() != null ? request.genericName().trim() : null);
        med.setCategory(request.category() != null ? request.category().trim() : null);
        med.setManufacturer(request.manufacturer() != null ? request.manufacturer().trim() : null);
        med.setHsnCode(request.hsnCode() != null ? request.hsnCode().trim() : null);
        med.setRackLocation(request.rackLocation() != null ? request.rackLocation().trim() : null);
        med.setUnitsPerPack(request.unitsPerPack() != null && request.unitsPerPack() > 0 ? request.unitsPerPack() : 1);
        med.setGstRate(request.gstRate() != null ? request.gstRate() : new BigDecimal("5.00"));
        med.setRequiresPrescription(Boolean.TRUE.equals(request.requiresPrescription()));
        med.setMinStockAlertLevel(request.minStockAlertLevel() != null ? request.minStockAlertLevel() : 10);
        return medicineRepository.save(med);
    }

    private String getColValue(List<String> tokens, Map<String, Integer> headerMap, String... colNames) {
        for (String col : colNames) {
            Integer idx = headerMap.get(col);
            if (idx != null && idx < tokens.size()) {
                String val = tokens.get(idx).trim();
                if (!val.isEmpty()) return val;
            }
        }
        return null;
    }

    private List<String> parseCsvLine(String line) {
        List<String> tokens = new ArrayList<>();
        StringBuilder sb = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                inQuotes = !inQuotes;
            } else if (c == ',' && !inQuotes) {
                tokens.add(sb.toString().trim());
                sb.setLength(0);
            } else {
                sb.append(c);
            }
        }
        tokens.add(sb.toString().trim());
        return tokens;
    }

    private LocalDate parseExpiryDate(String dateStr) {
        String clean = dateStr.trim();
        // 1. YYYY-MM-DD
        if (clean.matches("\\d{4}-\\d{2}-\\d{2}")) {
            try {
                return LocalDate.parse(clean);
            } catch (Exception ignored) {}
        }
        // 2. MM/YYYY or MM-YYYY
        if (clean.matches("\\d{1,2}[/-]\\d{4}")) {
            try {
                String[] parts = clean.split("[/-]");
                int month = Integer.parseInt(parts[0]);
                int year = Integer.parseInt(parts[1]);
                if (month >= 1 && month <= 12) {
                    return YearMonth.of(year, month).atEndOfMonth();
                }
            } catch (Exception ignored) {}
        }
        // 3. DD/MM/YYYY or DD-MM-YYYY
        if (clean.matches("\\d{1,2}[/-]\\d{1,2}[/-]\\d{4}")) {
            try {
                String sep = clean.contains("/") ? "/" : "-";
                DateTimeFormatter fmt = DateTimeFormatter.ofPattern("d" + sep + "M" + sep + "yyyy");
                return LocalDate.parse(clean, fmt);
            } catch (Exception ignored) {}
        }
        return null;
    }
}
