package com.annotationplatform.service;

import com.annotationplatform.entity.Document;
import com.annotationplatform.entity.Folder;
import com.annotationplatform.entity.User;
import com.annotationplatform.repository.DocumentRepository;
import com.annotationplatform.repository.FolderRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class FolderService {

    @Autowired
    private FolderRepository folderRepository;

    @Autowired
    private DocumentRepository documentRepository;

    public List<Folder> getFolders(Long parentId) {
        if (parentId == null) {
            return folderRepository.findByParentIsNullOrderByNameAsc();
        }
        return folderRepository.findByParent_IdOrderByNameAsc(parentId);
    }

    public Folder createFolder(String name, Long parentId, User creator) {
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("文件夹名称不能为空");
        }
        String folderName = name.trim();

        Folder parent = null;
        if (parentId != null) {
            parent = folderRepository.findById(parentId)
                    .orElseThrow(() -> new IllegalArgumentException("父级文件夹不存在"));
            if (folderRepository.existsByParent_IdAndName(parentId, folderName)) {
                throw new IllegalArgumentException("同级文件夹名称不能重复");
            }
        } else {
            if (folderRepository.existsByParentIsNullAndName(folderName)) {
                throw new IllegalArgumentException("根目录下存在同名文件夹");
            }
        }

        Folder folder = new Folder();
        folder.setName(folderName);
        folder.setParent(parent);
        folder.setDepth(parent != null ? parent.getDepth() + 1 : 0);
        folder.setPath(parent != null ? buildChildPath(parent.getPath(), folderName) : "/" + folderName);
        folder.setCreatedBy(creator);

        return folderRepository.save(folder);
    }

    @Transactional
    public Map<String, Object> deleteFolder(Long folderId) {
        if (folderId == null) {
            throw new IllegalArgumentException("文件夹ID不能为空");
        }
        Folder folder = folderRepository.findById(folderId)
                .orElseThrow(() -> new IllegalArgumentException("文件夹不存在"));

        List<Long> folderIds = collectFolderHierarchy(folder);
        List<Document> documentsToDelete = documentRepository.findAllByFolder_IdIn(folderIds);

        int deletedDocuments = deleteDocuments(documentsToDelete);

        deleteFoldersByHierarchy(folderIds);

        Map<String, Object> result = new HashMap<>();
        result.put("message", "文件夹删除成功");
        result.put("deletedCount", deletedDocuments);
        result.put("folderId", folderId);
        result.put("folderPath", folder.getPath());
        return result;
    }

    @Transactional
    public Folder renameFolder(Long folderId, String newName) {
        if (newName == null || newName.trim().isEmpty()) {
            throw new IllegalArgumentException("文件夹名称不能为空");
        }
        if (folderId == null) {
            throw new IllegalArgumentException("文件夹ID不能为空");
        }

        Folder folder = folderRepository.findById(folderId)
                .orElseThrow(() -> new IllegalArgumentException("文件夹不存在"));

        String trimmedName = newName.trim();
        if (trimmedName.equals(folder.getName())) {
            return folder;
        }

        Folder parent = folder.getParent();
        if (parent == null) {
            if (folderRepository.existsByParentIsNullAndName(trimmedName)) {
                throw new IllegalArgumentException("根目录下存在同名文件夹");
            }
        } else {
            if (folderRepository.existsByParent_IdAndName(parent.getId(), trimmedName)) {
                throw new IllegalArgumentException("同级文件夹名称不能重复");
            }
        }

        String oldPath = folder.getPath();
        int oldDepth = folder.getDepth();
        folder.setName(trimmedName);
        folder.setPath(parent != null ? buildChildPath(parent.getPath(), trimmedName) : "/" + trimmedName);
        Folder updatedFolder = folderRepository.save(folder);

        int depthDelta = updatedFolder.getDepth() - oldDepth;
        if (!oldPath.equals(updatedFolder.getPath()) || depthDelta != 0) {
            updateDescendantPaths(updatedFolder, oldPath, updatedFolder.getPath(), depthDelta);
        } else {
            updateDocumentFolderPaths(Collections.singletonList(updatedFolder.getId()));
        }

        return updatedFolder;
    }

    @Transactional
    public Folder moveFolder(Long folderId, Long targetParentId) {
        if (folderId == null) {
            throw new IllegalArgumentException("文件夹ID不能为空");
        }
        Folder folder = folderRepository.findById(folderId)
                .orElseThrow(() -> new IllegalArgumentException("文件夹不存在"));

        if (targetParentId != null && targetParentId.equals(folderId)) {
            throw new IllegalArgumentException("不能将文件夹移动到自身");
        }

        Folder newParent = null;
        if (targetParentId != null) {
            newParent = folderRepository.findById(targetParentId)
                    .orElseThrow(() -> new IllegalArgumentException("目标文件夹不存在"));
        }

        Long currentParentId = folder.getParent() != null ? folder.getParent().getId() : null;
        if (Objects.equals(currentParentId, targetParentId)) {
            return folder;
        }

        if (newParent != null) {
            if (newParent.getPath().startsWith(folder.getPath())) {
                throw new IllegalArgumentException("不能将文件夹移动到其子文件夹中");
            }
            if (folderRepository.existsByParent_IdAndName(newParent.getId(), folder.getName())) {
                throw new IllegalArgumentException("目标目录下存在同名文件夹");
            }
        } else if (folderRepository.existsByParentIsNullAndName(folder.getName())) {
            throw new IllegalArgumentException("根目录下存在同名文件夹");
        }

        String oldPath = folder.getPath();
        int oldDepth = folder.getDepth();

        folder.setParent(newParent);
        folder.setDepth(newParent != null ? newParent.getDepth() + 1 : 0);
        folder.setPath(newParent != null ? buildChildPath(newParent.getPath(), folder.getName()) : "/" + folder.getName());

        Folder updatedFolder = folderRepository.save(folder);

        int depthDelta = updatedFolder.getDepth() - oldDepth;
        if (!oldPath.equals(updatedFolder.getPath()) || depthDelta != 0) {
            updateDescendantPaths(updatedFolder, oldPath, updatedFolder.getPath(), depthDelta);
        } else {
            updateDocumentFolderPaths(Collections.singletonList(updatedFolder.getId()));
        }

        return updatedFolder;
    }

    private List<Long> collectFolderHierarchy(Folder root) {
        List<Long> collectedIds = new ArrayList<>();
        Queue<Long> queue = new LinkedList<>();
        queue.add(root.getId());

        while (!queue.isEmpty()) {
            Long currentId = queue.poll();
            collectedIds.add(currentId);
            List<Folder> children = folderRepository.findByParent_Id(currentId);
            for (Folder child : children) {
                queue.add(child.getId());
            }
        }
        return collectedIds;
    }

    private int deleteDocuments(List<Document> documents) {
        if (documents == null || documents.isEmpty()) {
            return 0;
        }
        int deletedCount = 0;
        for (Document document : documents) {
            try {
                Path filePath = Paths.get(document.getFilePath());
                Files.deleteIfExists(filePath);
            } catch (Exception e) {
                // Ignore and continue deleting the rest
            }
        }
        documentRepository.deleteAll(documents);
        deletedCount += documents.size();
        return deletedCount;
    }

    private void deleteFoldersByHierarchy(List<Long> folderIds) {
        if (folderIds == null || folderIds.isEmpty()) {
            return;
        }
        List<Folder> folders = folderRepository.findAllById(folderIds);
        List<Folder> sorted = folders.stream()
                .sorted(Comparator.comparing(Folder::getDepth).reversed())
                .collect(Collectors.toList());
        if (sorted.isEmpty()) {
            return;
        }
        folderRepository.deleteAll(sorted);
    }

    private String buildChildPath(String parentPath, String childName) {
        if (parentPath.endsWith("/")) {
            return parentPath + childName;
        }
        return parentPath + "/" + childName;
    }

    private void updateDescendantPaths(Folder rootFolder, String oldPath, String newPath, int depthDelta) {
        if (oldPath == null || newPath == null || rootFolder == null) {
            return;
        }
        List<Folder> descendants = folderRepository.findByPathStartingWith(oldPath + "/");
        if (descendants != null && !descendants.isEmpty()) {
            for (Folder child : descendants) {
                if (child == null) {
                    continue;
                }
                String childPath = child.getPath();
                if (childPath != null && childPath.startsWith(oldPath)) {
                    String updatedPath = newPath + childPath.substring(oldPath.length());
                    child.setPath(updatedPath);
                    child.setDepth(child.getDepth() + depthDelta);
                }
            }
            folderRepository.saveAll(descendants);
        }

        List<Long> affectedFolderIds = descendants == null
                ? new ArrayList<>()
                : descendants.stream().map(Folder::getId).collect(Collectors.toCollection(ArrayList::new));
        affectedFolderIds.add(rootFolder.getId());
        updateDocumentFolderPaths(affectedFolderIds);
    }

    private void updateDocumentFolderPaths(Collection<Long> folderIds) {
        if (folderIds == null || folderIds.isEmpty()) {
            return;
        }
        List<Document> documents = documentRepository.findAllByFolder_IdIn(folderIds);
        if (documents == null || documents.isEmpty()) {
            return;
        }
        for (Document document : documents) {
            Folder folder = document.getFolder();
            if (folder != null) {
                document.setFolderPath(folder.getPath());
            }
        }
        documentRepository.saveAll(documents);
    }
}

