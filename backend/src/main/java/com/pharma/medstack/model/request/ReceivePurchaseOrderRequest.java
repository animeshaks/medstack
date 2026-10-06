package com.pharma.medstack.model.request;

import java.util.List;

public record ReceivePurchaseOrderRequest(
    List<ReceiveItemRequest> items,
    String notes
) {}
