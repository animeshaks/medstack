package com.pharma.medstack.service;

import com.pharma.medstack.entity.Medicine;
import com.pharma.medstack.exception.ResourceNotFoundException;
import com.pharma.medstack.model.request.MedicineRequest;
import com.pharma.medstack.model.response.MedicineResponse;
import com.pharma.medstack.repository.MedicineRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class MedicineService {

    private final MedicineRepository medicineRepository;

    public MedicineService(MedicineRepository medicineRepository) {
        this.medicineRepository = medicineRepository;
    }

    public MedicineResponse createMedicine(MedicineRequest request) {
        Medicine medicine = new Medicine();
        medicine.setName(request.name());
        medicine.setGenericName(request.genericName());
        medicine.setCategory(request.category());
        medicine.setManufacturer(request.manufacturer());
        medicine.setHsnCode(request.hsnCode());
        medicine.setRackLocation(request.rackLocation());
        medicine.setRequiresPrescription(request.requiresPrescription());
        medicine.setMinStockAlertLevel(request.minStockAlertLevel());
        medicine.setUnitsPerPack(request.getUnitsPerPackOrDefault());
        medicine.setSymptoms(request.symptoms());
        medicine.setTargetAgeGroup(request.getTargetAgeGroupOrDefault());

        medicine = medicineRepository.save(medicine);
        return mapToResponse(medicine);
    }

    @Transactional(readOnly = true)
    public MedicineResponse getMedicine(UUID id) {
        Medicine medicine = medicineRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Medicine not found"));
        return mapToResponse(medicine);
    }

    @Transactional(readOnly = true)
    public Page<MedicineResponse> getAllMedicines(String search, Pageable pageable) {
        return getAllMedicines(search, null, null, pageable);
    }

    @Transactional(readOnly = true)
    public Page<MedicineResponse> getAllMedicines(String search, String symptom, String ageGroup, Pageable pageable) {
        Specification<Medicine> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.isFalse(root.get("isDeleted")));

            if (search != null && !search.trim().isEmpty()) {
                String pattern = "%" + search.trim().toLowerCase() + "%";
                Predicate pName = cb.like(cb.lower(root.get("name")), pattern);
                Predicate pGeneric = cb.like(cb.lower(root.get("genericName")), pattern);
                Predicate pMfg = cb.like(cb.lower(root.get("manufacturer")), pattern);
                Predicate pSymptom = cb.like(cb.lower(root.get("symptoms")), pattern);
                predicates.add(cb.or(pName, pGeneric, pMfg, pSymptom));
            }

            if (symptom != null && !symptom.trim().isEmpty()) {
                String symPattern = "%" + symptom.trim().toLowerCase() + "%";
                predicates.add(cb.like(cb.lower(root.get("symptoms")), symPattern));
            }

            if (ageGroup != null && !ageGroup.trim().isEmpty() && !"ALL".equalsIgnoreCase(ageGroup.trim())) {
                Predicate pAge = cb.equal(cb.upper(root.get("targetAgeGroup")), ageGroup.trim().toUpperCase());
                Predicate pAll = cb.equal(cb.upper(root.get("targetAgeGroup")), "ALL");
                predicates.add(cb.or(pAge, pAll));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return medicineRepository.findAll(spec, pageable).map(this::mapToResponse);
    }

    public MedicineResponse updateMedicine(UUID id, MedicineRequest request) {
        Medicine medicine = medicineRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Medicine not found"));

        medicine.setName(request.name());
        medicine.setGenericName(request.genericName());
        medicine.setCategory(request.category());
        medicine.setManufacturer(request.manufacturer());
        medicine.setHsnCode(request.hsnCode());
        medicine.setRackLocation(request.rackLocation());
        medicine.setRequiresPrescription(request.requiresPrescription());
        medicine.setMinStockAlertLevel(request.minStockAlertLevel());
        medicine.setUnitsPerPack(request.getUnitsPerPackOrDefault());
        medicine.setSymptoms(request.symptoms());
        medicine.setTargetAgeGroup(request.getTargetAgeGroupOrDefault());

        medicine = medicineRepository.save(medicine);
        return mapToResponse(medicine);
    }

    public void deleteMedicine(UUID id) {
        Medicine medicine = medicineRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Medicine not found"));
        medicine.setDeleted(true);
        medicineRepository.save(medicine);
    }

    private MedicineResponse mapToResponse(Medicine medicine) {
        return new MedicineResponse(
                medicine.getId(),
                medicine.getName(),
                medicine.getGenericName(),
                medicine.getCategory(),
                medicine.getManufacturer(),
                medicine.getHsnCode(),
                medicine.getRackLocation(),
                medicine.isRequiresPrescription(),
                medicine.getMinStockAlertLevel(),
                medicine.getUnitsPerPack(),
                medicine.getSymptoms(),
                medicine.getTargetAgeGroup() != null ? medicine.getTargetAgeGroup() : "ALL",
                medicine.getCreatedAt()
        );
    }
}
