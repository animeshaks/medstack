package com.pharma.medstack.service;

import com.pharma.medstack.entity.Supplier;
import com.pharma.medstack.exception.ResourceNotFoundException;
import com.pharma.medstack.model.request.SupplierRequest;
import com.pharma.medstack.model.response.SupplierResponse;
import com.pharma.medstack.repository.SupplierRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@Transactional
public class SupplierService {

    private final SupplierRepository supplierRepository;

    public SupplierService(SupplierRepository supplierRepository) {
        this.supplierRepository = supplierRepository;
    }

    public SupplierResponse createSupplier(SupplierRequest request) {
        Supplier supplier = new Supplier();
        supplier.setName(request.name());
        supplier.setContactPerson(request.contactPerson());
        supplier.setPhone(request.phone());
        supplier.setEmail(request.email());
        supplier.setGstin(request.gstin());
        supplier.setDlNumber(request.dlNumber());
        supplier.setAddress(request.address());

        supplier = supplierRepository.save(supplier);
        return mapToResponse(supplier);
    }

    @Transactional(readOnly = true)
    public SupplierResponse getSupplier(UUID id) {
        Supplier supplier = supplierRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Supplier not found"));
        return mapToResponse(supplier);
    }

    @Transactional(readOnly = true)
    public Page<SupplierResponse> getAllSuppliers(String search, Pageable pageable) {
        Page<Supplier> suppliers;
        if (search != null && !search.trim().isEmpty()) {
            suppliers = supplierRepository.searchByName(search, pageable);
        } else {
            suppliers = supplierRepository.findAllByIsDeletedFalse(pageable);
        }
        return suppliers.map(this::mapToResponse);
    }

    public SupplierResponse updateSupplier(UUID id, SupplierRequest request) {
        Supplier supplier = supplierRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Supplier not found"));

        supplier.setName(request.name());
        supplier.setContactPerson(request.contactPerson());
        supplier.setPhone(request.phone());
        supplier.setEmail(request.email());
        supplier.setGstin(request.gstin());
        supplier.setDlNumber(request.dlNumber());
        supplier.setAddress(request.address());

        supplier = supplierRepository.save(supplier);
        return mapToResponse(supplier);
    }

    public void deleteSupplier(UUID id) {
        Supplier supplier = supplierRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Supplier not found"));
        supplier.setDeleted(true);
        supplierRepository.save(supplier);
    }

    private SupplierResponse mapToResponse(Supplier supplier) {
        return new SupplierResponse(
                supplier.getId(),
                supplier.getName(),
                supplier.getContactPerson(),
                supplier.getPhone(),
                supplier.getEmail(),
                supplier.getGstin(),
                supplier.getDlNumber(),
                supplier.getAddress(),
                supplier.getOutstandingBalance() != null ? supplier.getOutstandingBalance() : java.math.BigDecimal.ZERO,
                supplier.getCreatedAt(),
                supplier.getUpdatedAt()
        );
    }
}
