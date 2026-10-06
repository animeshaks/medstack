package com.pharma.medstack.exception;

public class InvalidBillException extends RuntimeException {
    public InvalidBillException(String message) {
        super(message);
    }
}
