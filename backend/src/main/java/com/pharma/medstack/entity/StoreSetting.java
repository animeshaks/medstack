package com.pharma.medstack.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.util.UUID;

@Entity
@Table(name = "store_settings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StoreSetting extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "store_name", nullable = false)
    private String storeName;

    private String tagline;

    private String address;

    private String city;

    private String state;

    private String pincode;

    private String phone;

    private String email;

    private String gstin;

    @Column(name = "dl_number")
    private String dlNumber;

    @Column(name = "upi_id")
    private String upiId;

    @Column(name = "footer_note")
    private String footerNote;
}
