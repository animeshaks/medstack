package com.pharma.medstack.service;

import com.pharma.medstack.entity.StoreSetting;
import com.pharma.medstack.model.request.UpdateStoreSettingRequest;
import com.pharma.medstack.model.response.StoreSettingResponse;
import com.pharma.medstack.repository.StoreSettingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class StoreSettingService {

    private final StoreSettingRepository storeSettingRepository;

    public StoreSettingService(StoreSettingRepository storeSettingRepository) {
        this.storeSettingRepository = storeSettingRepository;
    }

    @Transactional(readOnly = true)
    public StoreSettingResponse getSettings() {
        StoreSetting setting = storeSettingRepository.findCurrentSettings()
                .orElseGet(this::createDefaultSettings);
        return mapToResponse(setting);
    }

    public StoreSettingResponse updateSettings(UpdateStoreSettingRequest request) {
        StoreSetting setting = storeSettingRepository.findCurrentSettings()
                .orElseGet(this::createDefaultSettings);

        setting.setStoreName(request.storeName());
        setting.setTagline(request.tagline());
        setting.setAddress(request.address());
        setting.setCity(request.city());
        setting.setState(request.state());
        setting.setPincode(request.pincode());
        setting.setPhone(request.phone());
        setting.setEmail(request.email());
        setting.setGstin(request.gstin());
        setting.setDlNumber(request.dlNumber());
        setting.setUpiId(request.upiId() != null && !request.upiId().isBlank() ? request.upiId().trim() : "medstack@okaxis");
        setting.setFooterNote(request.footerNote());

        setting = storeSettingRepository.save(setting);
        return mapToResponse(setting);
    }

    private StoreSetting createDefaultSettings() {
        StoreSetting defaultSetting = StoreSetting.builder()
                .storeName("MedStack Pharmacy")
                .tagline("Retail Chemists & Druggists")
                .address("Shop #12, Health Plaza, 100 Feet Road, Indiranagar")
                .city("Bengaluru")
                .state("Karnataka")
                .pincode("560038")
                .phone("+91 98765 43210")
                .email("contact@medstackpharma.in")
                .gstin("29AABCS1429B1ZV")
                .dlNumber("KA-BLR-2024-1029")
                .upiId("medstack@okaxis")
                .footerNote("Medicines once sold can only be returned with original bill within 7 days. Wishing you good health!")
                .build();
        return storeSettingRepository.save(defaultSetting);
    }

    private StoreSettingResponse mapToResponse(StoreSetting setting) {
        return new StoreSettingResponse(
                setting.getId(),
                setting.getStoreName(),
                setting.getTagline(),
                setting.getAddress(),
                setting.getCity(),
                setting.getState(),
                setting.getPincode(),
                setting.getPhone(),
                setting.getEmail(),
                setting.getGstin(),
                setting.getDlNumber(),
                setting.getUpiId() != null ? setting.getUpiId() : "medstack@okaxis",
                setting.getFooterNote(),
                setting.getUpdatedAt()
        );
    }
}
