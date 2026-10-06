package com.pharma.medstack.service;

import com.pharma.medstack.entity.Medicine;
import com.pharma.medstack.exception.ResourceNotFoundException;
import com.pharma.medstack.model.request.MedicineRequest;
import com.pharma.medstack.model.response.MedicineResponse;
import com.pharma.medstack.repository.MedicineRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MedicineServiceTest {

    @Mock
    private MedicineRepository medicineRepository;

    @InjectMocks
    private MedicineService medicineService;

    @Test
    void testCreateMedicine_success() {
        MedicineRequest request = new MedicineRequest("Dolo", "Paracetamol", "Painkiller", "Micro Labs", "1234", "R1", false, 10);
        Medicine medicine = new Medicine();
        medicine.setId(UUID.randomUUID());
        medicine.setName(request.name());
        medicine.setGenericName(request.genericName());

        when(medicineRepository.save(any(Medicine.class))).thenReturn(medicine);

        MedicineResponse response = medicineService.createMedicine(request);

        assertNotNull(response);
        assertEquals("Dolo", response.name());
        verify(medicineRepository, times(1)).save(any(Medicine.class));
    }

    @Test
    void testGetMedicine_notFound_throws() {
        UUID id = UUID.randomUUID();
        when(medicineRepository.findByIdAndIsDeletedFalse(id)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> medicineService.getMedicine(id));
    }

    @Test
    void testDeleteMedicine_softDeletes() {
        UUID id = UUID.randomUUID();
        Medicine medicine = new Medicine();
        medicine.setId(id);
        medicine.setDeleted(false);

        when(medicineRepository.findByIdAndIsDeletedFalse(id)).thenReturn(Optional.of(medicine));

        medicineService.deleteMedicine(id);

        assertTrue(medicine.isDeleted());
        verify(medicineRepository, times(1)).save(medicine);
    }
}
