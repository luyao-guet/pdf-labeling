import React, { useState, useEffect } from 'react';
import {
  Row, Col, Card, Button, Modal, Form, Input, Select, Space, Tag, Table,
  Popconfirm, Typography, message, Tabs, Checkbox, Divider, Empty
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, SettingOutlined,
  FileTextOutlined, ReloadOutlined, SaveOutlined, FormOutlined
} from '@ant-design/icons';
import { documentTypeService, formConfigService, DocumentType, FormConfig } from '../services/api';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const DataManagement: React.FC = () => {
  // Document Type Management State
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [documentTypeLoading, setDocumentTypeLoading] = useState(false);
  const [documentTypeModalVisible, setDocumentTypeModalVisible] = useState(false);
  const [editingDocumentType, setEditingDocumentType] = useState<DocumentType | null>(null);
  const [documentTypeForm] = Form.useForm();
  const [selectedDocumentTypeKeys, setSelectedDocumentTypeKeys] = useState<React.Key[]>([]);

  // Form Template Management State
  const [formConfigs, setFormConfigs] = useState<FormConfig[]>([]);
  const [formConfigLoading, setFormConfigLoading] = useState(false);
  const [formConfigModalVisible, setFormConfigModalVisible] = useState(false);
  const [editingFormConfig, setEditingFormConfig] = useState<FormConfig | null>(null);
  const [formConfigForm] = Form.useForm();
  const [selectedFormConfigKeys, setSelectedFormConfigKeys] = useState<React.Key[]>([]);

  // Template Configuration State
  const [templateConfigVisible, setTemplateConfigVisible] = useState(false);
  const [configuringDocumentType, setConfiguringDocumentType] = useState<DocumentType | null>(null);
  const [selectedFormConfigIds, setSelectedFormConfigIds] = useState<number[]>([]);
  const [availableFormConfigs, setAvailableFormConfigs] = useState<FormConfig[]>([]);

  // Duplicate conflict resolution state
  const [conflictModalVisible, setConflictModalVisible] = useState(false);
  const [conflictingIds, setConflictingIds] = useState<number[]>([]);
  const [conflictName, setConflictName] = useState<string>('');
  const [pendingCreateData, setPendingCreateData] = useState<any>(null);

  // Form Field Management State
  const [fieldManagementVisible, setFieldManagementVisible] = useState(false);
  const [managingFormConfig, setManagingFormConfig] = useState<FormConfig | null>(null);
  const [fields, setFields] = useState<any[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [fieldModalVisible, setFieldModalVisible] = useState(false);
  const [editingField, setEditingField] = useState<any | null>(null);
  const [fieldForm] = Form.useForm();

  // Load initial data
  useEffect(() => {
    loadDocumentTypes();
    loadFormConfigs();
  }, []);

  // Debug: Monitor conflict modal visibility
  useEffect(() => {
    if (conflictModalVisible) {
      console.log('Conflict modal is now visible, conflictingIds:', conflictingIds, 'conflictName:', conflictName);
    }
  }, [conflictModalVisible, conflictingIds, conflictName]);

  const loadDocumentTypes = async () => {
    try {
      setDocumentTypeLoading(true);
      const result = await documentTypeService.getDocumentTypes({ activeOnly: false });
      setDocumentTypes(result.documentTypes);
    } catch (error: any) {
      message.error('加载文档类型失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setDocumentTypeLoading(false);
    }
  };

  const loadFormConfigs = async () => {
    try {
      setFormConfigLoading(true);
      const result = await formConfigService.getFormConfigs({ activeOnly: false });
      console.log('Loaded form configs:', result.formConfigs);
      console.log('Form configs count:', result.formConfigs.length);
      console.log('Form configs details:', result.formConfigs.map(fc => ({
        id: fc.id,
        name: fc.name,
        isActive: fc.isActive,
        categoryId: fc.categoryId,
        categoryName: fc.categoryName
      })));
      setFormConfigs(result.formConfigs);
      setAvailableFormConfigs(result.formConfigs);
      if (result.formConfigs.length === 0) {
        console.warn('No form configs found. This might indicate a data loading issue.');
        console.warn('Please check:');
        console.warn('1. Backend logs for query results');
        console.warn('2. Database for existing form_configs with category_id IS NULL');
        console.warn('3. Network tab for API response');
      } else {
        console.log('Successfully loaded', result.formConfigs.length, 'form configs');
      }
    } catch (error: any) {
      message.error('加载表单模版失败: ' + (error.response?.data?.message || error.message));
      console.error('Failed to load form configs:', error);
      console.error('Error details:', error.response?.data);
    } finally {
      setFormConfigLoading(false);
    }
  };

  // Document Type Management Functions
  const handleAddDocumentType = () => {
    setEditingDocumentType(null);
    documentTypeForm.resetFields();
    setDocumentTypeModalVisible(true);
  };

  const handleEditDocumentType = (documentType: DocumentType) => {
    setEditingDocumentType(documentType);
    documentTypeForm.setFieldsValue({
      name: documentType.name,
      description: documentType.description,
      isActive: documentType.isActive !== false,
    });
    setDocumentTypeModalVisible(true);
  };

  const handleDeleteDocumentType = async (id: number) => {
    try {
      await documentTypeService.deleteDocumentType(id);
      message.success('文档类型删除成功');
      loadDocumentTypes();
    } catch (error: any) {
      message.error('删除失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleBatchDeleteDocumentTypes = async () => {
    if (selectedDocumentTypeKeys.length === 0) {
      message.warning('请选择要删除的文档类型');
      return;
    }
    try {
      for (const id of selectedDocumentTypeKeys) {
        await documentTypeService.deleteDocumentType(id as number);
      }
      message.success(`成功删除 ${selectedDocumentTypeKeys.length} 个文档类型`);
      setSelectedDocumentTypeKeys([]);
      loadDocumentTypes();
    } catch (error: any) {
      message.error('批量删除失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDocumentTypeModalOk = async () => {
    try {
      const values = await documentTypeForm.validateFields();
      if (editingDocumentType) {
        await documentTypeService.updateDocumentType(editingDocumentType.id, values);
        message.success('文档类型更新成功');
      } else {
        await documentTypeService.createDocumentType(values);
        message.success('文档类型创建成功');
      }
      setDocumentTypeModalVisible(false);
      documentTypeForm.resetFields();
      loadDocumentTypes();
    } catch (error: any) {
      message.error('操作失败: ' + (error.response?.data?.message || error.message));
    }
  };

  // Form Template Management Functions
  const handleAddFormConfig = () => {
    setEditingFormConfig(null);
    formConfigForm.resetFields();
    setFormConfigModalVisible(true);
  };

  const handleEditFormConfig = (formConfig: FormConfig) => {
    setEditingFormConfig(formConfig);
    formConfigForm.setFieldsValue({
      name: formConfig.name,
      description: formConfig.description,
      promptTemplate: formConfig.promptTemplate,
      isActive: formConfig.isActive !== false,
    });
    setFormConfigModalVisible(true);
  };

  const handleDeleteFormConfig = async (id: number) => {
    try {
      await formConfigService.deleteFormConfig(id);
      message.success('表单模版删除成功');
      loadFormConfigs();
    } catch (error: any) {
      message.error('删除失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleBatchDeleteFormConfigs = async () => {
    if (selectedFormConfigKeys.length === 0) {
      message.warning('请选择要删除的表单模版');
      return;
    }
    try {
      for (const id of selectedFormConfigKeys) {
        await formConfigService.deleteFormConfig(id as number);
      }
      message.success(`成功删除 ${selectedFormConfigKeys.length} 个表单模版`);
      setSelectedFormConfigKeys([]);
      loadFormConfigs();
    } catch (error: any) {
      message.error('批量删除失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDeleteConflictingConfigs = async () => {
    try {
      for (const id of conflictingIds) {
        await formConfigService.deleteFormConfig(id);
      }
      message.success(`成功删除 ${conflictingIds.length} 个冲突的表单模版`);
      setConflictModalVisible(false);
      setConflictingIds([]);
      setConflictName('');
      
      // Retry creating the form config
      if (pendingCreateData) {
        try {
          await formConfigService.createFormConfig(pendingCreateData);
          message.success('表单模版创建成功');
          setPendingCreateData(null);
          await loadFormConfigs();
        } catch (error: any) {
          message.error('创建失败: ' + (error.response?.data?.message || error.message));
        }
      }
    } catch (error: any) {
      message.error('删除失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleCancelConflictResolution = () => {
    setConflictModalVisible(false);
    setConflictingIds([]);
    setConflictName('');
    setPendingCreateData(null);
  };

  // Form Field Management Functions
  const handleManageFields = async (formConfig: FormConfig) => {
    setManagingFormConfig(formConfig);
    setFieldManagementVisible(true);
    await loadFormFields(formConfig.id);
  };

  const loadFormFields = async (formConfigId: number) => {
    try {
      setFieldsLoading(true);
      const result = await formConfigService.getFormFields(formConfigId);
      setFields(result.fields || []);
    } catch (error: any) {
      message.error('加载字段失败: ' + (error.response?.data?.message || error.message));
      setFields([]);
    } finally {
      setFieldsLoading(false);
    }
  };

  const handleAddField = () => {
    setEditingField(null);
    fieldForm.resetFields();
    fieldForm.setFieldsValue({
      fieldType: 'TEXT',
      required: false,
      sortOrder: fields.length,
    });
    setFieldModalVisible(true);
  };

  const handleEditField = (field: any) => {
    setEditingField(field);
    let optionsValue = '';
    if (field.options) {
      try {
        const options = typeof field.options === 'string' ? JSON.parse(field.options) : field.options;
        if (Array.isArray(options)) {
          optionsValue = options.join('\n');
        }
      } catch (e) {
        // If parsing fails, use as-is
        optionsValue = field.options;
      }
    }
    fieldForm.setFieldsValue({
      fieldName: field.fieldName,
      fieldType: field.fieldType,
      label: field.label,
      placeholder: field.placeholder,
      required: field.required,
      options: optionsValue,
      validationRules: field.validationRules ? (typeof field.validationRules === 'string' ? JSON.parse(field.validationRules) : field.validationRules) : {},
      sortOrder: field.sortOrder,
    });
    setFieldModalVisible(true);
  };

  const handleDeleteField = async (fieldId: number) => {
    try {
      await formConfigService.deleteFormField(fieldId);
      message.success('字段删除成功');
      if (managingFormConfig) {
        await loadFormFields(managingFormConfig.id);
        await loadFormConfigs(); // Refresh form configs to update field count
      }
    } catch (error: any) {
      message.error('删除失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleFieldModalOk = async () => {
    try {
      if (!managingFormConfig) return;
      const values = await fieldForm.validateFields();
      const fieldData: any = {
        fieldName: values.fieldName.trim(),
        fieldType: values.fieldType,
        label: values.label.trim(),
        required: values.required || false,
        sortOrder: values.sortOrder !== undefined ? values.sortOrder : fields.length,
      };

      if (values.placeholder) {
        fieldData.placeholder = values.placeholder.trim();
      }

      if (values.options && (values.fieldType === 'SELECT' || values.fieldType === 'MULTI_SELECT')) {
        fieldData.options = Array.isArray(values.options) ? JSON.stringify(values.options) : values.options;
      }

      if (values.validationRules) {
        fieldData.validationRules = typeof values.validationRules === 'object' 
          ? JSON.stringify(values.validationRules) 
          : values.validationRules;
      }

      if (editingField) {
        await formConfigService.updateFormField(editingField.id, fieldData);
        message.success('字段更新成功');
      } else {
        await formConfigService.addFormField(managingFormConfig.id, fieldData);
        message.success('字段添加成功');
      }

      setFieldModalVisible(false);
      fieldForm.resetFields();
      setEditingField(null);
      await loadFormFields(managingFormConfig.id);
      await loadFormConfigs(); // Refresh form configs to update field count
    } catch (error: any) {
      message.error('操作失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleFormConfigModalOk = async () => {
    let createData: any = null;
    let values: any = null;
    
    try {
      values = await formConfigForm.validateFields();
      if (editingFormConfig) {
        await formConfigService.updateFormConfig(editingFormConfig.id, values);
        message.success('表单模版更新成功');
      } else {
        // Prepare data for creation - ensure all fields are properly formatted
        const name = values.name?.trim();
        if (!name) {
          message.error('模版名称不能为空');
          return;
        }
        
        createData = {
          name: name,
        };
        
        // Add optional fields only if they have values
        if (values.description && values.description.trim()) {
          createData.description = values.description.trim();
        }
        if (values.promptTemplate && values.promptTemplate.trim()) {
          createData.promptTemplate = values.promptTemplate.trim();
        }
        // Always include isActive, default to true if not set
        createData.isActive = values.isActive !== undefined ? values.isActive : true;
        
        // Don't send categoryId for independent form configs
        // (backend will treat missing categoryId as null)
        
        console.log('Creating form config with data:', createData);
        console.log('Form config data JSON:', JSON.stringify(createData, null, 2));
        await formConfigService.createFormConfig(createData);
        message.success('表单模版创建成功');
      }
      setFormConfigModalVisible(false);
      setEditingFormConfig(null);
      formConfigForm.resetFields();
      await loadFormConfigs();
      // If template config modal is open, update the selected form configs list
      if (templateConfigVisible) {
        // The newly created form config will be automatically available
      }
    } catch (error: any) {
      // Log full error details for debugging
      console.error('Form config operation failed:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error response status:', error.response?.status);
      console.error('Error response headers:', error.response?.headers);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      
      // Extract error message from various possible locations
      let errorMessage = '未知错误';
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Check if it's a duplicate name error (various error message formats)
      const isDuplicateError = errorMessage.includes('已存在相同名称') || 
                                errorMessage.includes('已存在相同名称的独立表单配置') ||
                                errorMessage.includes('表单配置名称已存在') ||
                                errorMessage.includes('同一分类下已存在相同名称') ||
                                errorMessage.includes('Duplicate') ||
                                errorMessage.includes('duplicate');
      
      if (isDuplicateError) {
        console.log('Duplicate name error detected');
        const errorData = error.response?.data;
        // Ensure existingIds is a proper array
        let existingIds: number[] = [];
        if (errorData?.existingIds) {
          if (Array.isArray(errorData.existingIds)) {
            existingIds = errorData.existingIds;
          } else {
            // Convert to array if it's not already one
            existingIds = [errorData.existingIds].filter(id => id != null);
          }
        }
        const conflictNameValue = values?.name?.trim() || '';
        
        console.log('Error data:', errorData);
        console.log('ExistingIds from backend:', existingIds);
        console.log('ExistingIds type:', typeof existingIds);
        console.log('ExistingIds is array:', Array.isArray(existingIds));
        console.log('ExistingIds length:', existingIds?.length);
        console.log('Conflict name:', conflictNameValue);
        console.log('CreateData exists:', !!createData);
        console.log('Current formConfigs count:', formConfigs.length);
        
        // If we don't have existingIds from backend, try to find them from the loaded form configs
        if ((!existingIds || existingIds.length === 0) && conflictNameValue) {
          console.log('No existingIds from backend, searching in current formConfigs...');
          const matchingConfigs = formConfigs.filter(fc => 
            fc.name === conflictNameValue && (fc.categoryId === null || fc.categoryId === undefined)
          );
          console.log('Found matching configs in current list:', matchingConfigs.length);
          existingIds = matchingConfigs.map(fc => fc.id);
          console.log('ExistingIds after search:', existingIds);
        }
        
        // Only show conflict resolution modal if we have existing IDs and create data
        const hasExistingIds = existingIds && Array.isArray(existingIds) && existingIds.length > 0;
        console.log('Checking if should show modal: hasExistingIds =', hasExistingIds, ', createData =', !!createData);
        if (hasExistingIds && createData) {
          console.log('Showing conflict resolution modal with IDs:', existingIds);
          // Set conflict data first (use functional update to ensure correct state)
          setConflictingIds([...existingIds]);
          setConflictName(conflictNameValue || '');
          setPendingCreateData(createData);
          // Close the form config modal first
          setFormConfigModalVisible(false);
          // Use a longer delay to ensure form modal animation completes
          // Also log to confirm the state update happens
          setTimeout(() => {
            console.log('Setting conflictModalVisible to true, current state:', {
              conflictingIds: existingIds,
              conflictName: conflictNameValue,
              pendingCreateData: !!createData
            });
            setConflictModalVisible(true);
            // Force a re-render check
            console.log('Modal visibility state updated, should be visible now');
          }, 600);
        } else {
          console.log('Cannot show modal - hasExistingIds =', hasExistingIds, ', createData =', !!createData);
          // For duplicate errors without existingIds, reload first to get latest data
          // Then try to find matching configs from the fresh data
          console.log('No existingIds from backend, attempting to find matching configs...');
          console.log('Conflict name:', conflictNameValue);
          console.log('Current formConfigs count:', formConfigs.length);
          
          try {
            const result = await formConfigService.getFormConfigs({ activeOnly: false });
            const allConfigs = result.formConfigs;
            console.log('Reloaded form configs count:', allConfigs.length);
            console.log('All form config names:', allConfigs.map(fc => ({ id: fc.id, name: fc.name, categoryId: fc.categoryId })));
            
            const matchingConfigs = allConfigs.filter(fc => 
              fc.name === conflictNameValue && (fc.categoryId === null || fc.categoryId === undefined)
            );
            console.log('Matching configs found:', matchingConfigs.length);
            console.log('Matching configs:', matchingConfigs.map(fc => ({ id: fc.id, name: fc.name })));
            
            const foundIds = matchingConfigs.map(fc => fc.id);
            
            if (foundIds.length > 0 && createData) {
              console.log('Found existing configs, showing conflict resolution modal');
              // Set conflict data first
              setConflictingIds(foundIds);
              setConflictName(conflictNameValue);
              setPendingCreateData(createData);
              // Also update the form configs list
              setFormConfigs(allConfigs);
              setAvailableFormConfigs(allConfigs);
              // Close the form config modal first
              setFormConfigModalVisible(false);
              // Open conflict modal after a delay to ensure form modal animation completes
              setTimeout(() => {
                console.log('Setting conflictModalVisible to true (reload path)', {
                  conflictingIds: foundIds,
                  conflictName: conflictNameValue,
                  pendingCreateData: !!createData
                });
                setConflictModalVisible(true);
                console.log('Modal visibility state updated (reload path), should be visible now');
              }, 600);
            } else {
              console.log('No matching configs found, showing error message');
              // Still couldn't find, show error message and reload
              message.error(errorMessage + '。请使用不同的名称或刷新列表查看现有模版。', 6);
              await loadFormConfigs();
            }
          } catch (reloadError: any) {
            // If reload fails, just show the error message
            console.error('Failed to reload form configs:', reloadError);
            message.error(errorMessage + '。请使用不同的名称或刷新列表查看现有模版。', 6);
          }
        }
      } else {
        message.error('操作失败: ' + errorMessage);
      }
    }
  };

  // Template Configuration Functions
  const handleConfigureTemplates = async (documentType: DocumentType) => {
    setConfiguringDocumentType(documentType);
    try {
      const result = await documentTypeService.getDocumentTypeFormConfigs(documentType.id);
      setSelectedFormConfigIds(result.formConfigs.map(fc => fc.id));
      // Reload form configs to get latest data
      await loadFormConfigs();
      setTemplateConfigVisible(true);
    } catch (error: any) {
      message.error('加载配置失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleAddFormConfigFromConfig = () => {
    setEditingFormConfig(null);
    formConfigForm.resetFields();
    setFormConfigModalVisible(true);
  };

  const handleEditFormConfigFromConfig = (formConfig: FormConfig) => {
    setEditingFormConfig(formConfig);
    formConfigForm.setFieldsValue({
      name: formConfig.name,
      description: formConfig.description,
      promptTemplate: formConfig.promptTemplate,
      isActive: formConfig.isActive !== false,
    });
    setFormConfigModalVisible(true);
  };

  const handleSaveTemplateConfig = async () => {
    if (!configuringDocumentType) return;
    try {
      await documentTypeService.assignFormConfigs(configuringDocumentType.id, selectedFormConfigIds);
      message.success('表单模版配置保存成功');
      setTemplateConfigVisible(false);
      setConfiguringDocumentType(null);
      setSelectedFormConfigIds([]);
      loadDocumentTypes();
    } catch (error: any) {
      message.error('保存失败: ' + (error.response?.data?.message || error.message));
    }
  };

  // Document Type Table Columns
  const documentTypeColumns = [
    {
      title: '类型名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '表单模版数',
      dataIndex: 'formConfigCount',
      key: 'formConfigCount',
      width: 120,
      render: (count: number) => count || 0,
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: DocumentType) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<SettingOutlined />}
            onClick={() => handleConfigureTemplates(record)}
          >
            配置模版
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditDocumentType(record)}
          >
            编辑
          </Button>
        </Space>
      ),
    },
  ];

  // Form Config Table Columns
  const formConfigColumns = [
    {
      title: '模版名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '字段数',
      dataIndex: 'fieldCount',
      key: 'fieldCount',
      width: 100,
      render: (count: number) => count || 0,
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_: any, record: FormConfig) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<FormOutlined />}
            onClick={() => handleManageFields(record)}
          >
            管理字段
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditFormConfig(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description="确定要删除这个表单模版吗？"
            onConfirm={() => handleDeleteFormConfig(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <Card>
        <div style={{ marginBottom: 24 }}>
          <Title level={2} style={{ margin: 0 }}>
            <FileTextOutlined style={{ marginRight: 12, color: '#1890ff' }} />
            数据管理
          </Title>
        </div>

        <Tabs
          defaultActiveKey="document-types"
          items={[
            {
              key: 'document-types',
              label: '文档类型管理',
              children: (
                <div>
                  <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleAddDocumentType}
                      >
                        新建文档类型
                      </Button>
                      {selectedDocumentTypeKeys.length > 0 && (
                        <Popconfirm
                          title="确认批量删除"
                          description={`确定要删除选中的 ${selectedDocumentTypeKeys.length} 个文档类型吗？`}
                          onConfirm={handleBatchDeleteDocumentTypes}
                          okText="确定"
                          cancelText="取消"
                        >
                          <Button
                            danger
                            icon={<DeleteOutlined />}
                          >
                            批量删除 ({selectedDocumentTypeKeys.length})
                          </Button>
                        </Popconfirm>
                      )}
                    </Space>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={loadDocumentTypes}
                    >
                      刷新
                    </Button>
                  </div>
                  <Table
                    columns={documentTypeColumns}
                    dataSource={documentTypes}
                    loading={documentTypeLoading}
                    rowKey="id"
                    rowSelection={{
                      selectedRowKeys: selectedDocumentTypeKeys,
                      onChange: (selectedKeys) => setSelectedDocumentTypeKeys(selectedKeys),
                    }}
                    scroll={{ x: 1000 }}
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      showTotal: (total) => `共 ${total} 条`,
                    }}
                  />
                </div>
              ),
            },
            {
              key: 'form-templates',
              label: '表单模版管理',
              children: (
                <div>
                  <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleAddFormConfig}
                      >
                        新建表单模版
                      </Button>
                      {selectedFormConfigKeys.length > 0 && (
                        <Popconfirm
                          title="确认批量删除"
                          description={`确定要删除选中的 ${selectedFormConfigKeys.length} 个表单模版吗？`}
                          onConfirm={handleBatchDeleteFormConfigs}
                          okText="确定"
                          cancelText="取消"
                        >
                          <Button
                            danger
                            icon={<DeleteOutlined />}
                          >
                            批量删除 ({selectedFormConfigKeys.length})
                          </Button>
                        </Popconfirm>
                      )}
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={loadFormConfigs}
                      >
                        刷新
                      </Button>
                    </Space>
                    <Text type="secondary">
                      共 {formConfigs.length} 条记录
                      {formConfigs.length > 0 && (
                        <span style={{ marginLeft: 8 }}>
                          (启用: {formConfigs.filter(fc => fc.isActive).length}, 
                          禁用: {formConfigs.filter(fc => !fc.isActive).length})
                        </span>
                      )}
                    </Text>
                  </div>
                  {formConfigs.length === 0 && !formConfigLoading ? (
                    <Empty 
                      description="暂无表单模版"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    >
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleAddFormConfig}
                      >
                        创建第一个表单模版
                      </Button>
                    </Empty>
                  ) : (
                    <Table
                      columns={formConfigColumns}
                      dataSource={formConfigs}
                      loading={formConfigLoading}
                      rowKey="id"
                      rowSelection={{
                        selectedRowKeys: selectedFormConfigKeys,
                        onChange: (selectedKeys) => setSelectedFormConfigKeys(selectedKeys),
                      }}
                      scroll={{ x: 1000 }}
                      pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条`,
                      }}
                      locale={{
                        emptyText: formConfigLoading ? '加载中...' : '暂无数据'
                      }}
                    />
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Document Type Modal */}
      <Modal
        title={editingDocumentType ? '编辑文档类型' : '新建文档类型'}
        open={documentTypeModalVisible}
        onOk={handleDocumentTypeModalOk}
        onCancel={() => {
          setDocumentTypeModalVisible(false);
          setEditingDocumentType(null);
          documentTypeForm.resetFields();
        }}
        width={600}
      >
        <Form form={documentTypeForm} layout="vertical">
          <Form.Item
            name="name"
            label="类型名称"
            rules={[{ required: true, message: '请输入类型名称' }]}
          >
            <Input placeholder="请输入文档类型名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea
              rows={3}
              placeholder="请输入描述（可选）"
              showCount
              maxLength={500}
            />
          </Form.Item>
          <Form.Item
            name="isActive"
            label="状态"
            valuePropName="checked"
            initialValue={true}
          >
            <Checkbox>启用</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      {/* Form Config Modal */}
      <Modal
        title={editingFormConfig ? '编辑表单模版' : '新建表单模版'}
        open={formConfigModalVisible}
        onOk={handleFormConfigModalOk}
        onCancel={() => {
          setFormConfigModalVisible(false);
          setEditingFormConfig(null);
          formConfigForm.resetFields();
        }}
        width={700}
      >
        <Form form={formConfigForm} layout="vertical">
          <Form.Item
            name="name"
            label="模版名称"
            rules={[{ required: true, message: '请输入模版名称' }]}
          >
            <Input placeholder="请输入表单模版名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea
              rows={3}
              placeholder="请输入描述（可选）"
              showCount
              maxLength={500}
            />
          </Form.Item>
          <Form.Item name="promptTemplate" label="提示词模版">
            <TextArea
              rows={4}
              placeholder="请输入提示词模版（可选）"
              showCount
            />
          </Form.Item>
          <Form.Item
            name="isActive"
            label="状态"
            valuePropName="checked"
            initialValue={true}
          >
            <Checkbox>启用</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      {/* Conflict Resolution Modal */}
      <Modal
        title={
          <span>
            <DeleteOutlined style={{ marginRight: 8, color: '#ff4d4f' }} />
            名称冲突 - 需要删除冲突的数据
          </span>
        }
        open={conflictModalVisible}
        onCancel={handleCancelConflictResolution}
        maskClosable={false}
        closable={true}
        destroyOnHidden={true}
        footer={[
          <Button key="cancel" onClick={handleCancelConflictResolution}>
            取消
          </Button>,
          <Popconfirm
            key="delete"
            title="确认删除"
            description={`确定要删除这 ${conflictingIds.length} 个冲突的表单模版吗？删除后将自动创建新的模版。`}
            onConfirm={handleDeleteConflictingConfigs}
            okText="确定删除并创建"
            cancelText="取消"
          >
            <Button type="primary" danger>
              删除冲突数据并创建
            </Button>
          </Popconfirm>
        ]}
        width={600}
        zIndex={2000}
        centered={true}
      >
        <div style={{ marginBottom: 16 }}>
          <Text>
            检测到已存在名为 <Text strong>"{conflictName}"</Text> 的独立表单模版（共 {conflictingIds.length} 个）。
          </Text>
        </div>
        <Divider />
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            冲突的表单模版 ID: {conflictingIds.join(', ')}
          </Text>
        </div>
        <div style={{ padding: '12px', background: '#fff7e6', border: '1px solid #ffd591', borderRadius: '6px' }}>
          <Text type="warning">
            <strong>提示：</strong>删除冲突的数据后，系统将自动使用您输入的信息创建新的表单模版。
          </Text>
        </div>
      </Modal>

      {/* Field Management Modal */}
      <Modal
        title={
          <span>
            <FormOutlined style={{ marginRight: 8 }} />
            管理字段 - {managingFormConfig?.name}
          </span>
        }
        open={fieldManagementVisible}
        onCancel={() => {
          setFieldManagementVisible(false);
          setManagingFormConfig(null);
          setFields([]);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setFieldManagementVisible(false);
            setManagingFormConfig(null);
            setFields([]);
          }}>
            关闭
          </Button>,
        ]}
        width={1400}
        style={{ top: 20 }}
        styles={{ body: { maxHeight: 'calc(100vh - 150px)', overflowY: 'auto', padding: '24px' } }}
      >
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Text strong style={{ fontSize: 16 }}>表单模版：{managingFormConfig?.name}</Text>
            {managingFormConfig?.description && (
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 14 }}>{managingFormConfig.description}</Text>
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">共 {fields.length} 个字段</Text>
            </div>
          </div>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={handleAddField}
          >
            添加字段
          </Button>
        </div>
        <Divider style={{ margin: '16px 0 24px 0' }} />
        {fields.length === 0 && !fieldsLoading ? (
          <Empty description="暂无字段" image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddField}
            >
              添加第一个字段
            </Button>
          </Empty>
        ) : (
          <Table
            columns={[
              {
                title: '排序',
                dataIndex: 'sortOrder',
                key: 'sortOrder',
                width: 80,
                fixed: 'left',
                sorter: (a: any, b: any) => a.sortOrder - b.sortOrder,
                render: (order: number) => <Text strong>{order}</Text>,
              },
              {
                title: '字段名',
                dataIndex: 'fieldName',
                key: 'fieldName',
                width: 180,
                fixed: 'left',
                render: (name: string) => <Text code style={{ fontSize: 13 }}>{name}</Text>,
              },
              {
                title: '标签',
                dataIndex: 'label',
                key: 'label',
                width: 150,
                render: (label: string) => <Text strong>{label}</Text>,
              },
              {
                title: '字段类型',
                dataIndex: 'fieldType',
                key: 'fieldType',
                width: 120,
                render: (type: string) => {
                  const typeMap: Record<string, { label: string; color: string }> = {
                    TEXT: { label: '文本', color: 'blue' },
                    NUMBER: { label: '数字', color: 'cyan' },
                    DATE: { label: '日期', color: 'green' },
                    SELECT: { label: '单选', color: 'orange' },
                    MULTI_SELECT: { label: '多选', color: 'purple' },
                    BOOLEAN: { label: '布尔', color: 'geekblue' },
                  };
                  const typeInfo = typeMap[type] || { label: type, color: 'default' };
                  return <Tag color={typeInfo.color}>{typeInfo.label}</Tag>;
                },
              },
              {
                title: '必填',
                dataIndex: 'required',
                key: 'required',
                width: 100,
                render: (required: boolean) => (
                  <Tag color={required ? 'red' : 'default'} style={{ margin: 0 }}>
                    {required ? '是' : '否'}
                  </Tag>
                ),
              },
              {
                title: '占位符',
                dataIndex: 'placeholder',
                key: 'placeholder',
                width: 180,
                ellipsis: true,
                render: (placeholder: string) => placeholder ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>{placeholder}</Text>
                ) : (
                  <Text type="disabled" style={{ fontSize: 12 }}>-</Text>
                ),
              },
              {
                title: '选项',
                dataIndex: 'options',
                key: 'options',
                width: 200,
                ellipsis: true,
                render: (options: string, record: any) => {
                  if (!options || (record.fieldType !== 'SELECT' && record.fieldType !== 'MULTI_SELECT')) {
                    return <Text type="disabled" style={{ fontSize: 12 }}>-</Text>;
                  }
                  try {
                    const optionsArray = typeof options === 'string' ? JSON.parse(options) : options;
                    if (Array.isArray(optionsArray) && optionsArray.length > 0) {
                      return (
                        <Space size={[0, 4]} wrap>
                          {optionsArray.slice(0, 3).map((opt: string, idx: number) => (
                            <Tag key={idx} style={{ margin: 0 }}>{opt}</Tag>
                          ))}
                          {optionsArray.length > 3 && (
                            <Tag style={{ margin: 0 }}>+{optionsArray.length - 3}</Tag>
                          )}
                        </Space>
                      );
                    }
                  } catch (e) {
                    // Ignore parse error
                  }
                  return <Text type="disabled" style={{ fontSize: 12 }}>-</Text>;
                },
              },
              {
                title: '操作',
                key: 'action',
                width: 180,
                fixed: 'right',
                render: (_: any, record: any) => (
                  <Space size="small">
                    <Button
                      type="primary"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => handleEditField(record)}
                    >
                      编辑
                    </Button>
                    <Popconfirm
                      title="确认删除"
                      description="确定要删除这个字段吗？此操作不可恢复。"
                      onConfirm={() => handleDeleteField(record.id)}
                      okText="确定删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                    >
                      <Button 
                        danger 
                        size="small" 
                        icon={<DeleteOutlined />}
                      >
                        删除
                      </Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
            dataSource={fields}
            loading={fieldsLoading}
            rowKey="id"
            scroll={{ x: 1400, y: 'calc(100vh - 400px)' }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条`,
              pageSizeOptions: ['10', '20', '50', '100'],
            }}
            locale={{
              emptyText: fieldsLoading ? '加载中...' : '暂无字段数据'
            }}
            size="middle"
          />
        )}
      </Modal>

      {/* Field Modal */}
      <Modal
        title={
          <span style={{ fontSize: 18 }}>
            {editingField ? (
              <>
                <EditOutlined style={{ marginRight: 8 }} />
                编辑字段
              </>
            ) : (
              <>
                <PlusOutlined style={{ marginRight: 8 }} />
                添加字段
              </>
            )}
          </span>
        }
        open={fieldModalVisible}
        onOk={handleFieldModalOk}
        onCancel={() => {
          setFieldModalVisible(false);
          setEditingField(null);
          fieldForm.resetFields();
        }}
        width={800}
        okText="保存"
        cancelText="取消"
        okButtonProps={{ size: 'large' }}
        cancelButtonProps={{ size: 'large' }}
      >
        <Form form={fieldForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="fieldName"
                label={
                  <span>
                    <Text strong>字段名</Text>
                    <Text type="danger"> *</Text>
                  </span>
                }
                rules={[{ required: true, message: '请输入字段名' }]}
                tooltip="字段的唯一标识符，使用英文和下划线"
              >
                <Input size="large" placeholder="例如: field_name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="label"
                label={
                  <span>
                    <Text strong>标签</Text>
                    <Text type="danger"> *</Text>
                  </span>
                }
                rules={[{ required: true, message: '请输入标签' }]}
                tooltip="字段的显示名称"
              >
                <Input size="large" placeholder="例如: 字段名称" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="fieldType"
                label={
                  <span>
                    <Text strong>字段类型</Text>
                    <Text type="danger"> *</Text>
                  </span>
                }
                rules={[{ required: true, message: '请选择字段类型' }]}
              >
                <Select size="large" placeholder="请选择字段类型">
                  <Option value="TEXT">
                    <Tag color="blue">文本</Tag> TEXT
                  </Option>
                  <Option value="NUMBER">
                    <Tag color="cyan">数字</Tag> NUMBER
                  </Option>
                  <Option value="DATE">
                    <Tag color="green">日期</Tag> DATE
                  </Option>
                  <Option value="SELECT">
                    <Tag color="orange">单选</Tag> SELECT
                  </Option>
                  <Option value="MULTI_SELECT">
                    <Tag color="purple">多选</Tag> MULTI_SELECT
                  </Option>
                  <Option value="BOOLEAN">
                    <Tag color="geekblue">布尔</Tag> BOOLEAN
                  </Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="sortOrder"
                label={<Text strong>排序顺序</Text>}
                tooltip="数字越小越靠前，默认为字段数量"
              >
                <Input type="number" size="large" placeholder="数字越小越靠前" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="placeholder" label={<Text strong>占位符</Text>}>
                <Input size="large" placeholder="请输入占位符文本（可选）" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="required"
                label={<Text strong>必填设置</Text>}
                valuePropName="checked"
                initialValue={false}
              >
                <Checkbox style={{ fontSize: 14, paddingTop: 8 }}>必填字段</Checkbox>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.fieldType !== currentValues.fieldType
            }
          >
            {({ getFieldValue }) => {
              const fieldType = getFieldValue('fieldType');
              if (fieldType === 'SELECT' || fieldType === 'MULTI_SELECT') {
                return (
                  <Form.Item
                    name="options"
                    label={
                      <span>
                        <Text strong>选项配置</Text>
                        <Text type="warning" style={{ marginLeft: 8, fontSize: 12 }}>
                          （{fieldType === 'SELECT' ? '单选' : '多选'}类型需要）
                        </Text>
                      </span>
                    }
                    tooltip="请输入选项，每行一个，将自动转换为JSON数组"
                    normalize={(value) => {
                      if (!value) return [];
                      const lines = value.split('\n').filter((line: string) => line.trim());
                      return lines;
                    }}
                  >
                    <TextArea
                      rows={6}
                      placeholder={`例如：\n选项1\n选项2\n选项3\n...`}
                      showCount
                      style={{ fontSize: 14 }}
                    />
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>
        </Form>
      </Modal>

      {/* Template Configuration Modal */}
      <Modal
        title={
          <span>
            <SettingOutlined style={{ marginRight: 8 }} />
            配置表单模版 - {configuringDocumentType?.name}
          </span>
        }
        open={templateConfigVisible}
        onOk={handleSaveTemplateConfig}
        onCancel={() => {
          setTemplateConfigVisible(false);
          setConfiguringDocumentType(null);
          setSelectedFormConfigIds([]);
        }}
        width={900}
        okText="保存"
        cancelText="取消"
        style={{ top: 20 }}
        styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' } }}
      >
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary">
            为文档类型 "{configuringDocumentType?.name}" 选择可用的表单模版。可以选择多个模版。
          </Text>
          <Space>
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={handleAddFormConfigFromConfig}
            >
              新增模版
            </Button>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={loadFormConfigs}
            >
              刷新
            </Button>
          </Space>
        </div>
        <Divider />
        {availableFormConfigs.length === 0 ? (
          <Empty description="暂无可用表单模版">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddFormConfigFromConfig}
            >
              创建第一个表单模版
            </Button>
          </Empty>
        ) : (
          <div>
            <Checkbox.Group
              value={selectedFormConfigIds}
              onChange={(values) => setSelectedFormConfigIds(values as number[])}
              style={{ width: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                {availableFormConfigs.map((formConfig) => (
                  <Card
                    key={formConfig.id}
                    size="small"
                    style={{
                      marginBottom: 8,
                      border: selectedFormConfigIds.includes(formConfig.id)
                        ? '2px solid #1890ff'
                        : '1px solid #d9d9d9',
                    }}
                    actions={[
                      <Button
                        key="edit"
                        type="link"
                        icon={<EditOutlined />}
                        onClick={() => handleEditFormConfigFromConfig(formConfig)}
                      >
                        编辑
                      </Button>
                    ]}
                  >
                    <Checkbox value={formConfig.id}>
                      <div style={{ marginLeft: 24, width: '100%' }}>
                        <div style={{ fontWeight: 500, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                          <span>{formConfig.name}</span>
                          <Tag color={formConfig.isActive ? 'green' : 'red'}>
                            {formConfig.isActive ? '启用' : '禁用'}
                          </Tag>
                        </div>
                        {formConfig.description && (
                          <div style={{ color: '#666', fontSize: '12px', marginBottom: 4 }}>
                            {formConfig.description}
                          </div>
                        )}
                        <div style={{ color: '#999', fontSize: '12px' }}>
                          字段数: {formConfig.fieldCount || 0}
                        </div>
                      </div>
                    </Checkbox>
                  </Card>
                ))}
              </Space>
            </Checkbox.Group>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DataManagement;
