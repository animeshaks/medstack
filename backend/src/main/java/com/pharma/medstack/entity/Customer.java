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
@Table(name = "customers")
@Getter
@Setter
@NoArgsConstructor
public class Customer extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String phone;

    private String email;

    @Column(name = "preferred_doctor_id")
    private UUID preferredDoctorId;

    private String address;

    @Column(name = "reward_points", nullable = false)
    private int rewardPoints;

    @Column(name = "outstanding_balance", precision = 12, scale = 2, nullable = false)
    private java.math.BigDecimal outstandingBalance = java.math.BigDecimal.ZERO;
}
