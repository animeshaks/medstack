package com.pharma.medstack.service;

import com.pharma.medstack.entity.Doctor;
import com.pharma.medstack.exception.ResourceNotFoundException;
import com.pharma.medstack.model.request.DoctorRequest;
import com.pharma.medstack.model.response.DoctorResponse;
import com.pharma.medstack.repository.DoctorRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@Transactional
public class DoctorService {

    private final DoctorRepository doctorRepository;

    public DoctorService(DoctorRepository doctorRepository) {
        this.doctorRepository = doctorRepository;
    }

    public DoctorResponse createDoctor(DoctorRequest request) {
        Doctor doctor = new Doctor();
        doctor.setName(request.name());
        doctor.setSpecialization(request.specialization());
        doctor.setPhone(request.phone());
        doctor.setEmail(request.email());
        doctor.setClinicHospitalName(request.clinicHospitalName());
        doctor.setRegistrationNumber(request.registrationNumber());

        doctor = doctorRepository.save(doctor);
        return mapToResponse(doctor);
    }

    @Transactional(readOnly = true)
    public DoctorResponse getDoctor(UUID id) {
        Doctor doctor = doctorRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found"));
        return mapToResponse(doctor);
    }

    @Transactional(readOnly = true)
    public Page<DoctorResponse> getAllDoctors(String search, Pageable pageable) {
        Page<Doctor> doctors;
        if (search != null && !search.trim().isEmpty()) {
            doctors = doctorRepository.searchByName(search, pageable);
        } else {
            doctors = doctorRepository.findAllByIsDeletedFalse(pageable);
        }
        return doctors.map(this::mapToResponse);
    }

    public DoctorResponse updateDoctor(UUID id, DoctorRequest request) {
        Doctor doctor = doctorRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found"));

        doctor.setName(request.name());
        doctor.setSpecialization(request.specialization());
        doctor.setPhone(request.phone());
        doctor.setEmail(request.email());
        doctor.setClinicHospitalName(request.clinicHospitalName());
        doctor.setRegistrationNumber(request.registrationNumber());

        doctor = doctorRepository.save(doctor);
        return mapToResponse(doctor);
    }

    public void deleteDoctor(UUID id) {
        Doctor doctor = doctorRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor not found"));
        doctor.setDeleted(true);
        doctorRepository.save(doctor);
    }

    private DoctorResponse mapToResponse(Doctor doctor) {
        return new DoctorResponse(
                doctor.getId(),
                doctor.getName(),
                doctor.getSpecialization(),
                doctor.getPhone(),
                doctor.getEmail(),
                doctor.getClinicHospitalName(),
                doctor.getRegistrationNumber(),
                doctor.getCreatedAt(),
                doctor.getUpdatedAt()
        );
    }
}
