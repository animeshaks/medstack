package com.pharma.medstack.exception;

public class ExpiredBatchException extends RuntimeException {
    public ExpiredBatchException(String message) {
        super(message);
    }
}
