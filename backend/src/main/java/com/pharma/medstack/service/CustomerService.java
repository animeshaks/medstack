package com.pharma.medstack.service;

import com.pharma.medstack.entity.Customer;
import com.pharma.medstack.exception.BusinessValidationException;
import com.pharma.medstack.exception.ResourceNotFoundException;
import com.pharma.medstack.model.request.CustomerRequest;
import com.pharma.medstack.model.response.CustomerResponse;
import com.pharma.medstack.repository.CustomerRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Service
@Transactional
public class CustomerService {

    private final CustomerRepository customerRepository;

    public CustomerService(CustomerRepository customerRepository) {
        this.customerRepository = customerRepository;
    }

    public CustomerResponse createCustomer(CustomerRequest request) {
        if (customerRepository.existsByPhoneAndIsDeletedFalse(request.phone())) {
            throw new BusinessValidationException("Phone number already exists");
        }

        Customer customer = new Customer();
        customer.setName(request.name());
        customer.setPhone(request.phone());
        customer.setEmail(request.email());
        customer.setPreferredDoctorId(request.preferredDoctorId());
        customer.setAddress(request.address());
        customer.setRewardPoints(0);

        customer = customerRepository.save(customer);
        return mapToResponse(customer);
    }

    @Transactional(readOnly = true)
    public CustomerResponse getCustomer(UUID id) {
        Customer customer = customerRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found"));
        return mapToResponse(customer);
    }

    @Transactional(readOnly = true)
    public Page<CustomerResponse> getAllCustomers(String search, Pageable pageable) {
        Page<Customer> customers;
        if (search != null && !search.trim().isEmpty()) {
            customers = customerRepository.searchByNameOrPhone(search, pageable);
        } else {
            customers = customerRepository.findAllByIsDeletedFalse(pageable);
        }
        return customers.map(this::mapToResponse);
    }

    public CustomerResponse updateCustomer(UUID id, CustomerRequest request) {
        Customer customer = customerRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found"));

        Optional<Customer> existingByPhone = customerRepository.findByPhoneAndIsDeletedFalse(request.phone());
        if (existingByPhone.isPresent() && !existingByPhone.get().getId().equals(id)) {
            throw new BusinessValidationException("Phone number already in use by another customer");
        }

        customer.setName(request.name());
        customer.setPhone(request.phone());
        customer.setEmail(request.email());
        customer.setPreferredDoctorId(request.preferredDoctorId());
        customer.setAddress(request.address());

        customer = customerRepository.save(customer);
        return mapToResponse(customer);
    }

    public void deleteCustomer(UUID id) {
        Customer customer = customerRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found"));
        customer.setDeleted(true);
        customerRepository.save(customer);
    }

    private CustomerResponse mapToResponse(Customer customer) {
        return new CustomerResponse(
                customer.getId(),
                customer.getName(),
                customer.getPhone(),
                customer.getEmail(),
                customer.getPreferredDoctorId(),
                customer.getAddress(),
                customer.getRewardPoints(),
                customer.getOutstandingBalance() != null ? customer.getOutstandingBalance() : java.math.BigDecimal.ZERO,
                customer.getCreatedAt()
        );
    }
}
