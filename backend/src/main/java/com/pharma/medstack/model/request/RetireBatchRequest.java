package com.pharma.medstack.model.request;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import java.util.UUID;

public record RetireBatchRequest(
    @NotEmpty List<UUID> batchIds
) {}
