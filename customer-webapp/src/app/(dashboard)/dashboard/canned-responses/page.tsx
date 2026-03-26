'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, message as antdMessage, Popconfirm, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import apiClient from '@/lib/api-client';
import { CannedResponse, CannedResponseRequest } from '@/types/canned-response';

const { TextArea } = Input;

interface Result<T> {
  code: number;
  message: string;
  data: T;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export default function CannedResponsesPage() {
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingResponse, setEditingResponse] = useState<CannedResponse | null>(null);
  const [form] = Form.useForm();

  const fetchCannedResponses = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<CannedResponse[]>('/api/canned-responses');
      setCannedResponses(response.data || []);
    } catch (error) {
      console.error('Failed to fetch canned responses:', error);
      antdMessage.error('Failed to load canned responses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCannedResponses();
  }, []);

  const handleAdd = () => {
    setEditingResponse(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: CannedResponse) => {
    setEditingResponse(record);
    form.setFieldsValue({
      shortcut: record.shortcut,
      content: record.content,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await apiClient.delete(`/api/canned-responses/${id}`);
      antdMessage.success('Canned response deleted successfully');
      fetchCannedResponses();
    } catch (error) {
      console.error('Failed to delete canned response:', error);
      antdMessage.error('Failed to delete canned response');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload: CannedResponseRequest = {
        shortcut: values.shortcut,
        content: values.content,
      };

      if (editingResponse) {
        await apiClient.put(`/api/canned-responses/${editingResponse.id}`, payload);
        antdMessage.success('Canned response updated successfully');
      } else {
        await apiClient.post('/api/canned-responses', payload);
        antdMessage.success('Canned response created successfully');
      }

      setModalVisible(false);
      form.resetFields();
      fetchCannedResponses();
    } catch (error: any) {
      if (error.errorFields) {
        return;
      }
      console.error('Failed to save canned response:', error);
      antdMessage.error('Failed to save canned response');
    }
  };

  const columns = [
    {
      title: 'Shortcut',
      dataIndex: 'shortcut',
      key: 'shortcut',
      width: 150,
      render: (text: string) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>/{text}</span>,
    },
    {
      title: 'Content',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (text: string) => (
        <span style={{ color: '#4b5563' }}>
          {text.length > 100 ? `${text.substring(0, 100)}...` : text}
        </span>
      ),
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_: any, record: CannedResponse) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
          >
            Edit
          </Button>
          <Popconfirm
            title="Are you sure you want to delete this canned response?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              size="small"
            >
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>
          Canned Responses
        </h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAdd}
          className="bg-[#2563eb] hover:bg-[#1d4ed8]"
        >
          Add Canned Response
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={cannedResponses}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showTotal: (total) => `Total ${total} items`,
          }}
        />
      </Card>

      <Modal
        title={editingResponse ? 'Edit Canned Response' : 'Add Canned Response'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        okText="Save"
        cancelText="Cancel"
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 24 }}
        >
          <Form.Item
            label="Shortcut"
            name="shortcut"
            rules={[
              { required: true, message: 'Please enter a shortcut' },
              { pattern: /^[a-zA-Z0-9-_]+$/, message: 'Only letters, numbers, hyphens and underscores allowed' },
            ]}
            extra="Type this after / in chat to insert this response"
          >
            <Input
              placeholder="e.g., thanks, hello, followup"
              prefix="/"
              maxLength={50}
            />
          </Form.Item>

          <Form.Item
            label="Content"
            name="content"
            rules={[
              { required: true, message: 'Please enter the response content' },
              { max: 2000, message: 'Content cannot exceed 2000 characters' },
            ]}
          >
            <TextArea
              placeholder="Enter the canned response text..."
              autoSize={{ minRows: 4, maxRows: 12 }}
              maxLength={2000}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
