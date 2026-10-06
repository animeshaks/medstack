package com.pharma.medstack.service;

import com.pharma.medstack.entity.Expense;
import com.pharma.medstack.entity.User;
import com.pharma.medstack.exception.ResourceNotFoundException;
import com.pharma.medstack.model.request.ExpenseRequest;
import com.pharma.medstack.model.response.ExpenseResponse;
import com.pharma.medstack.repository.ExpenseRepository;
import com.pharma.medstack.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExpenseService {

    private final ExpenseRepository expenseRepository;
    private final UserRepository userRepository;

    @Transactional
    public ExpenseResponse createExpense(ExpenseRequest request, String username) {
        User user = userRepository.findByUsernameAndIsDeletedFalse(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Expense expense = Expense.builder()
                .category(request.category())
                .amount(request.amount())
                .description(request.description())
                .expenseDate(request.expenseDate())
                .loggedBy(user)
                .build();
        
        expense = expenseRepository.save(expense);
        log.info("EXPENSE_LOGGED id={} category={} amount={} user={}", expense.getId(), expense.getCategory(), expense.getAmount(), username);
        return mapToResponse(expense);
    }

    @Transactional(readOnly = true)
    public Page<ExpenseResponse> getAllExpenses(Pageable pageable) {
        return getAllExpenses(null, null, null, null, null, null, pageable);
    }

    @Transactional(readOnly = true)
    public Page<ExpenseResponse> getAllExpenses(String search, String category, LocalDate startDate, LocalDate endDate, Integer month, Integer year, Pageable pageable) {
        Pageable resolvedPageable = pageable;
        if (pageable.getSort().isUnsorted()) {
            resolvedPageable = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(),
                    Sort.by(Sort.Direction.DESC, "expenseDate").and(Sort.by(Sort.Direction.DESC, "createdAt")));
        }

        LocalDate effectiveStart = startDate;
        LocalDate effectiveEnd = endDate;
        if (year != null) {
            if (month != null && month >= 1 && month <= 12) {
                effectiveStart = LocalDate.of(year, month, 1);
                effectiveEnd = effectiveStart.plusMonths(1).minusDays(1);
            } else if (effectiveStart == null && effectiveEnd == null) {
                effectiveStart = LocalDate.of(year, 1, 1);
                effectiveEnd = LocalDate.of(year, 12, 31);
            }
        }

        final LocalDate finalStart = effectiveStart;
        final LocalDate finalEnd = effectiveEnd;

        Specification<Expense> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.isFalse(root.get("isDeleted")));

            if (category != null && !category.trim().isEmpty() && !"ALL".equalsIgnoreCase(category.trim())) {
                predicates.add(cb.equal(cb.lower(root.get("category")), category.trim().toLowerCase()));
            }

            if (finalStart != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("expenseDate"), finalStart));
            }
            if (finalEnd != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("expenseDate"), finalEnd));
            }

            if (search != null && !search.trim().isEmpty()) {
                String pattern = "%" + search.trim().toLowerCase() + "%";
                Predicate pCat = cb.like(cb.lower(root.get("category")), pattern);
                Predicate pDesc = cb.like(cb.lower(root.get("description")), pattern);
                predicates.add(cb.or(pCat, pDesc));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return expenseRepository.findAll(spec, resolvedPageable).map(this::mapToResponse);
    }

    @Transactional(readOnly = true)
    public ExpenseResponse getExpense(UUID id) {
        Expense expense = expenseRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Expense not found"));
        return mapToResponse(expense);
    }

    @Transactional
    public ExpenseResponse updateExpense(UUID id, ExpenseRequest request, String username) {
        Expense expense = expenseRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Expense not found"));

        expense.setCategory(request.category());
        expense.setAmount(request.amount());
        expense.setDescription(request.description());
        expense.setExpenseDate(request.expenseDate());

        expense = expenseRepository.save(expense);
        log.info("EXPENSE_UPDATED id={} user={}", expense.getId(), username);
        return mapToResponse(expense);
    }

    @Transactional
    public void deleteExpense(UUID id) {
        Expense expense = expenseRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Expense not found"));
        expense.setDeleted(true);
        expenseRepository.save(expense);
        log.info("EXPENSE_DELETED id={}", id);
    }

    private ExpenseResponse mapToResponse(Expense expense) {
        return new ExpenseResponse(
                expense.getId(),
                expense.getCategory(),
                expense.getAmount(),
                expense.getDescription(),
                expense.getExpenseDate(),
                expense.getLoggedBy() != null ? expense.getLoggedBy().getUsername() : null,
                expense.getCreatedAt()
        );
    }
}
