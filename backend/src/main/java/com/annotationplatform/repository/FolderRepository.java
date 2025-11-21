package com.annotationplatform.repository;

import com.annotationplatform.entity.Folder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FolderRepository extends JpaRepository<Folder, Long> {

    List<Folder> findByParentIsNullOrderByNameAsc();

    List<Folder> findByParent_IdOrderByNameAsc(Long parentId);

    boolean existsByParent_IdAndName(Long parentId, String name);

    boolean existsByParentIsNullAndName(String name);

    List<Folder> findByParent_Id(Long parentId);

    List<Folder> findByPathStartingWith(String pathPrefix);

}

