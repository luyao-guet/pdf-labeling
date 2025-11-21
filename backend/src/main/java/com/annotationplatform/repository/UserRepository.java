package com.annotationplatform.repository;

import com.annotationplatform.entity.User;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    Boolean existsByUsername(String username);

    Boolean existsByEmail(String email);

    List<User> findByRoleInAndStatus(List<User.Role> roles, User.Status status);

    // 性能优化查询方法
    @Query("SELECT u FROM User u WHERE u.status = :status ORDER BY u.score DESC, u.createdAt ASC")
    List<User> findAllActiveUsersOrderedByScore(@Param("status") User.Status status);

    @Query("SELECT COUNT(u) FROM User u WHERE u.role = :role AND u.status = :status")
    Long countByRoleAndStatus(@Param("role") User.Role role, @Param("status") User.Status status);

    @Query("SELECT u FROM User u WHERE u.role IN :roles AND u.status = :status ORDER BY u.createdAt DESC")
    List<User> findByRolesAndStatusOrderedByCreatedDate(@Param("roles") List<User.Role> roles, @Param("status") User.Status status);

    default List<User> findAll(Sort sort) {
        // 提供默认的排序查询方法
        return findAll(sort);
    }
}
