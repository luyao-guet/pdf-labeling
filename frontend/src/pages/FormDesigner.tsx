import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Button, Modal, Form, Input, Select, Switch, Space, Typography, message, Tabs, Divider } from 'antd';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, SaveOutlined, FormOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import api, { formConfigService } from '../services/api';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

interface FormField {
  id?: string;
  fieldName: string;
  fieldType: string;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  validationRules?: any;
  sortOrder: number;
}

interface FormConfig {
  id?: string;
  name: string;
  description?: string;
  categoryId: number | null;
  categoryName?: string;
  promptTemplate?: string;
  fields: FormField[];
}

const FormDesigner: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [formConfig, setFormConfig] = useState<FormConfig>({
    name: '',
    description: '',
    categoryId: null as number | null,
    fields: []
  });

  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldModalVisible, setFieldModalVisible] = useState(false);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  // 可用字段类型
  const fieldTypes = [
    { value: 'TEXT', label: '文本输入', icon: '📝' },
    { value: 'NUMBER', label: '数字输入', icon: '🔢' },
    { value: 'DATE', label: '日期选择', icon: '📅' },
    { value: 'SELECT', label: '单选下拉', icon: '📋' },
    { value: 'MULTI_SELECT', label: '多选框', icon: '☑️' },
    { value: 'BOOLEAN', label: '开关/复选', icon: '🔘' },
    { value: 'TEXTAREA', label: '多行文本', icon: '📄' }
  ];

  useEffect(() => {
    loadCategories();
    if (id) {
      loadFormConfig();
    }
  }, [id]);

  const loadCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data.categories || []);
    } catch (error) {
      message.error('加载分类失败');
    }
  };

  const loadFormConfig = async () => {
    if (!id) return;

    setLoading(true);
    try {
      // First get the form config
      const configResponse = await formConfigService.getFormConfig(parseInt(id));
      const config = configResponse.formConfig;

      // Then try to get fields, but don't fail if it doesn't exist
      let fields: any[] = [];
      try {
        const fieldsResponse = await api.get(`/form-configs/${id}/fields`);
        fields = fieldsResponse.data.fields || [];
      } catch (fieldsError) {
        console.warn('Could not load form fields:', fieldsError);
        // Fields might not exist yet for new forms
      }

      setFormConfig({
        id: config.id,
        name: config.name,
        description: config.description,
        categoryId: config.categoryId,
        categoryName: config.categoryName,
        promptTemplate: config.promptTemplate,
        fields: fields.map((field: any, index: number) => ({
          id: field.id,
          fieldName: field.fieldName,
          fieldType: field.fieldType,
          label: field.label,
          placeholder: field.placeholder,
          required: field.required,
          options: field.options ? (typeof field.options === 'string' ? JSON.parse(field.options) : field.options) : [],
          validationRules: field.validationRules ? (typeof field.validationRules === 'string' ? JSON.parse(field.validationRules) : field.validationRules) : {},
          sortOrder: index
        }))
      });
    } catch (error: any) {
      console.error('Load form config error:', error);
      message.error(error.response?.data?.message || '加载表单配置失败');
    } finally {
      setLoading(false);
    }
  };

  const saveFormConfig = async () => {
    if (!formConfig.name.trim()) {
      message.error('请输入表单名称');
      return;
    }

    if (!formConfig.categoryId || formConfig.categoryId === 0) {
      message.error('请选择分类');
      return;
    }

    setSaving(true);
    try {
      const configData = {
        name: formConfig.name,
        description: formConfig.description,
        categoryId: formConfig.categoryId,
        promptTemplate: formConfig.promptTemplate,
        isActive: true
      };

      let savedConfig;
      if (formConfig.id) {
        // 更新现有配置
        const response = await api.put(`/form-configs/${formConfig.id}`, configData);
        savedConfig = response.data.formConfig;
        message.success('表单配置更新成功');
      } else {
        // 创建新配置
        const response = await api.post('/form-configs', configData);
        savedConfig = response.data.formConfig;
        setFormConfig(prev => ({ ...prev, id: savedConfig.id }));
        message.success('表单配置创建成功');
      }

      // 保存字段
      await saveFields(savedConfig.id);

    } catch (error: any) {
      message.error(error.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const saveFields = async (configId: string) => {
    // 这里应该实现字段的保存逻辑
    // 为简化，暂时跳过
    console.log('Saving fields for config:', configId, formConfig.fields);
  };

  const addField = (fieldType: string) => {
    const fieldTypeInfo = fieldTypes.find(type => type.value === fieldType);
    if (!fieldTypeInfo) return;

    const newField: FormField = {
      fieldName: `field_${Date.now()}`,
      fieldType,
      label: fieldTypeInfo.label,
      placeholder: '',
      required: false,
      options: fieldType === 'SELECT' || fieldType === 'MULTI_SELECT' ? [] : undefined,
      validationRules: {},
      sortOrder: formConfig.fields.length
    };

    setFormConfig(prev => ({
      ...prev,
      fields: [...prev.fields, newField]
    }));

    setEditingField(newField);
    setFieldModalVisible(true);
  };

  const editField = (field: FormField) => {
    setEditingField({ ...field });
    setFieldModalVisible(true);
  };

  const deleteField = (index: number) => {
    setFormConfig(prev => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== index)
    }));
  };

  const handleFieldModalOk = () => {
    if (!editingField) return;

    form.validateFields().then(values => {
      const updatedField: FormField = {
        ...editingField,
        ...values,
        options: values.options || []
      };

      setFormConfig(prev => {
        const fields = [...prev.fields];
        const index = fields.findIndex(f => f.fieldName === editingField.fieldName);
        if (index >= 0) {
          fields[index] = updatedField;
        } else {
          fields.push(updatedField);
        }
        return { ...prev, fields };
      });

      setFieldModalVisible(false);
      setEditingField(null);
      form.resetFields();
    });
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const fields = Array.from(formConfig.fields);
    const [reorderedField] = fields.splice(result.source.index, 1);
    fields.splice(result.destination.index, 0, reorderedField);

    // 更新排序
    fields.forEach((field, index) => {
      field.sortOrder = index;
    });

    setFormConfig(prev => ({ ...prev, fields }));
  };

  const renderFieldPreview = (field: FormField) => {
    const commonProps = {
      placeholder: field.placeholder,
      required: field.required,
      style: { width: '100%' }
    };

    switch (field.fieldType) {
      case 'TEXT':
        return <Input {...commonProps} />;
      case 'NUMBER':
        return <Input type="number" {...commonProps} />;
      case 'DATE':
        return <Input type="date" {...commonProps} />;
      case 'SELECT':
        return (
          <Select {...commonProps}>
            {field.options?.filter(option => option != null && option !== '').map(option => (
              <Option key={option} value={option}>{option}</Option>
            ))}
          </Select>
        );
      case 'MULTI_SELECT':
        return (
          <Select mode="multiple" {...commonProps}>
            {field.options?.filter(option => option != null && option !== '').map(option => (
              <Option key={option} value={option}>{option}</Option>
            ))}
          </Select>
        );
      case 'BOOLEAN':
        return <Switch />;
      case 'TEXTAREA':
        return <Input.TextArea {...commonProps} rows={3} />;
      default:
        return <Input {...commonProps} />;
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={2}>
            <FormOutlined style={{ marginRight: '12px' }} />
            表单设计器
          </Title>
          <Space>
            <Button
              icon={<EyeOutlined />}
              onClick={() => setPreviewMode(!previewMode)}
            >
              {previewMode ? '编辑模式' : '预览模式'}
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={saveFormConfig}
            >
              保存配置
            </Button>
          </Space>
        </div>

        <Card title="基本信息" size="small">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="表单名称" required>
                <Input
                  value={formConfig.name}
                  onChange={(e) => setFormConfig(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="请输入表单名称"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="所属分类" required>
                <Select
                  value={formConfig.categoryId}
                  onChange={(value) => setFormConfig(prev => ({ ...prev, categoryId: value }))}
                  placeholder="请选择分类"
                  style={{ width: '100%' }}
                >
                  {categories.map(category => (
                    <Option key={category.id} value={category.id}>{category.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="描述">
                <Input
                  value={formConfig.description}
                  onChange={(e) => setFormConfig(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="请输入表单描述"
                />
              </Form.Item>
            </Col>
          </Row>
          <Row>
            <Col span={24}>
              <Form.Item label="提示词模板">
                <Input.TextArea
                  value={formConfig.promptTemplate}
                  onChange={(e) => setFormConfig(prev => ({ ...prev, promptTemplate: e.target.value }))}
                  placeholder="请输入AI识别的提示词模板"
                  rows={3}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Row gutter={24}>
          {/* 字段工具箱 */}
          {!previewMode && (
            <Col span={6}>
              <Card title="字段工具箱" size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  {fieldTypes.map(type => (
                    <Button
                      key={type.value}
                      type="dashed"
                      block
                      icon={<span style={{ marginRight: '8px' }}>{type.icon}</span>}
                      onClick={() => addField(type.value)}
                    >
                      {type.label}
                    </Button>
                  ))}
                </Space>
              </Card>
            </Col>
          )}

          {/* 表单设计区 */}
          <Col span={previewMode ? 24 : 18}>
            <Card
              title={previewMode ? "表单预览" : "表单设计区"}
              size="small"
              extra={
                !previewMode && (
                  <Text type="secondary">
                    拖拽字段可调整顺序，点击字段可编辑属性
                  </Text>
                )
              }
            >
              {formConfig.fields.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                  {previewMode ? '暂无字段，请切换到编辑模式添加字段' : '请从左侧拖拽字段类型到此处'}
                </div>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="form-fields">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef}>
                        <Space direction="vertical" style={{ width: '100%' }}>
                          {formConfig.fields.map((field, index) => (
                            <Draggable
                              key={field.fieldName}
                              draggableId={field.fieldName}
                              index={index}
                              isDragDisabled={previewMode}
                            >
                              {(provided) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  style={{
                                    ...provided.draggableProps.style,
                                    marginBottom: '12px'
                                  }}
                                >
                                  <Card
                                    size="small"
                                    style={{ cursor: previewMode ? 'default' : 'move' }}
                                    extra={
                                      !previewMode && (
                                        <Space>
                                          <Button
                                            type="text"
                                            size="small"
                                            icon={<EditOutlined />}
                                            onClick={() => editField(field)}
                                          />
                                          <Button
                                            type="text"
                                            size="small"
                                            danger
                                            icon={<DeleteOutlined />}
                                            onClick={() => deleteField(index)}
                                          />
                                        </Space>
                                      )
                                    }
                                  >
                                    <div style={{ marginBottom: '8px' }}>
                                      <Space>
                                        <Text strong>{field.label}</Text>
                                        {field.required && <Text type="danger">*</Text>}
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                          ({field.fieldType})
                                        </Text>
                                      </Space>
                                    </div>
                                    {renderFieldPreview(field)}
                                  </Card>
                                </div>
                              )}
                            </Draggable>
                          ))}
                        </Space>
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </Card>
          </Col>
        </Row>
      </Space>

      {/* 字段编辑模态框 */}
      <Modal
        title={editingField?.id ? "编辑字段" : "添加字段"}
        open={fieldModalVisible}
        onOk={handleFieldModalOk}
        onCancel={() => {
          setFieldModalVisible(false);
          setEditingField(null);
          form.resetFields();
        }}
        width={600}
      >
        <Form form={form} layout="vertical" initialValues={editingField || {}}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="fieldName"
                label="字段名称"
                rules={[{ required: true, message: '请输入字段名称' }]}
              >
                <Input placeholder="用于数据存储的唯一标识" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="label"
                label="显示标签"
                rules={[{ required: true, message: '请输入显示标签' }]}
              >
                <Input placeholder="用户看到的字段名称" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="fieldType"
                label="字段类型"
              >
                <Select disabled>
                  {fieldTypes.map(type => (
                    <Option key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="required" label="是否必填" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="placeholder" label="占位符">
            <Input placeholder="输入框的提示文本" />
          </Form.Item>

          {(editingField?.fieldType === 'SELECT' || editingField?.fieldType === 'MULTI_SELECT') && (
            <Form.Item
              name="options"
              label="选项列表"
              rules={[{ required: true, message: '请选择或添加选项' }]}
            >
              <Select
                mode="tags"
                placeholder="输入选项，按回车添加"
                style={{ width: '100%' }}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default FormDesigner;
