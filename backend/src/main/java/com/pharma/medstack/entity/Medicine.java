package com.pharma.medstack.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "medicines")
@Getter
@Setter
@NoArgsConstructor
public class Medicine extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(name = "generic_name")
    private String genericName;

    private String category;

    private String manufacturer;

    @Column(name = "hsn_code")
    private String hsnCode;

    @Column(name = "rack_location")
    private String rackLocation;

    @Column(name = "requires_prescription", nullable = false)
    private boolean requiresPrescription;

    @Column(name = "min_stock_alert_level", nullable = false)
    private int minStockAlertLevel;

    @Column(name = "units_per_pack", nullable = false)
    private int unitsPerPack = 1;

    @Column(name = "symptoms")
    private String symptoms;

    @Column(name = "target_age_group")
    private String targetAgeGroup = "ALL";
}
