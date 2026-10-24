package com.pharma.medstack.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "inventory_batches")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InventoryBatch extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "item_id", nullable = false)
    private Medicine medicine;

    @Column(name = "batch_number", nullable = false)
    private String batchNumber;

    @Column(name = "expiry_date", nullable = false)
    private LocalDate expiryDate;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal mrp;

    @Column(name = "cost_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal costPrice;

    @Column(name = "selling_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal sellingPrice;

    @Column(nullable = false)
    @Builder.Default
    private int quantity = 0;

    @Column(name = "loose_quantity", nullable = false)
    @Builder.Default
    private int looseQuantity = 0;

    @Column(name = "is_retired", nullable = false)
    @Builder.Default
    private boolean isRetired = false;

    @Column(name = "is_old_stock", nullable = false)
    @Builder.Default
    private boolean isOldStock = false;

    @Column(name = "stock_source", nullable = false)
    @Builder.Default
    private String stockSource = "PURCHASE";

    @Column(name = "stock_notes")
    private String stockNotes;
}
