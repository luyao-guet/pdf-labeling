import React, { useState, useEffect } from 'react';
import { Card, Table, Avatar, Badge, Typography, Space, message, Modal, Input, Button, Form, InputNumber } from 'antd';
import { TrophyOutlined, CrownOutlined, StarOutlined } from '@ant-design/icons';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import api from '../services/api';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface UserRanking {
  userId: number;
  username: string;
  score: number;
  role: string;
  rank: number;
}

interface UserScoreStats {
  currentScore: number;
  totalEarned: number;
  totalSpent: number;
  rank: number;
  monthlyScore: number;
}

const ScoreRanking: React.FC = () => {
  const [rankings, setRankings] = useState<UserRanking[]>([]);
  const [userStats, setUserStats] = useState<UserScoreStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRanking | null>(null);
  const [adjustForm] = Form.useForm();

  const user = useSelector((state: RootState) => state.user.currentUser);

  useEffect(() => {
    loadRankings();
    loadUserStats();
  }, []);

  const loadRankings = async () => {
    setLoading(true);
    try {
      const response = await api.get('/scores/ranking');
      setRankings(response.data);
    } catch (error) {
      message.error('加载排行榜失败');
    } finally {
      setLoading(false);
    }
  };

  const loadUserStats = async () => {
    if (!user) return;

    setStatsLoading(true);
    try {
      const response = await api.get('/scores/stats');
      setUserStats(response.data);
    } catch (error) {
      console.error('加载个人统计失败', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleAdjustScore = async (values: any) => {
    if (!selectedUser) return;

    try {
      await api.post(`/scores/admin/adjust/${selectedUser.userId}`, null, {
        params: {
          scoreChange: values.scoreChange,
          reason: values.reason
        }
      });
      message.success('积分调整成功');
      setAdjustModalVisible(false);
      adjustForm.resetFields();
      loadRankings();
    } catch (error) {
      message.error('积分调整失败');
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <CrownOutlined style={{ color: '#FFD700', fontSize: '20px' }} />;
      case 2:
        return <TrophyOutlined style={{ color: '#C0C0C0', fontSize: '20px' }} />;
      case 3:
        return <span style={{ fontSize: '20px', color: '#CD7F32' }}>🏅</span>;
      default:
        return <span style={{ fontWeight: 'bold', color: '#666' }}>#{rank}</span>;
    }
  };

  const getRoleBadge = (role: string) => {
    const roleMap: { [key: string]: { color: string; text: string } } = {
      ADMIN: { color: 'red', text: '管理员' },
      EXPERT: { color: 'gold', text: '专家' },
      REVIEWER: { color: 'blue', text: '检查员' },
      ANNOTATOR: { color: 'green', text: '标注员' }
    };

    const roleInfo = roleMap[role] || { color: 'default', text: role };
    return <Badge color={roleInfo.color} text={roleInfo.text} />;
  };

  const columns = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      render: (rank: number) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {getRankIcon(rank)}
        </div>
      )
    },
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      render: (username: string, record: UserRanking) => (
        <Space>
          <Avatar style={{ backgroundColor: '#1890ff' }}>
            {username.charAt(0).toUpperCase()}
          </Avatar>
          <div>
            <div style={{ fontWeight: 'bold' }}>{username}</div>
            {getRoleBadge(record.role)}
          </div>
        </Space>
      )
    },
    {
      title: '积分',
      dataIndex: 'score',
      key: 'score',
      render: (score: number) => (
        <Space>
          <StarOutlined style={{ color: '#FFD700' }} />
          <Text strong style={{ fontSize: '16px' }}>{score}</Text>
        </Space>
      ),
      sorter: (a: UserRanking, b: UserRanking) => b.score - a.score
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: UserRanking) => (
        user?.role === 'admin' && record.userId !== user.id ? (
          <Button
            type="link"
            onClick={() => {
              setSelectedUser(record);
              setAdjustModalVisible(true);
            }}
          >
            调整积分
          </Button>
        ) : null
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={2}>
            <TrophyOutlined style={{ marginRight: '12px' }} />
            积分排行榜
          </Title>
          <Text type="secondary">展示用户积分排名和个人统计信息</Text>
        </div>

        {/* 个人统计卡片 */}
        {user && userStats && (
          <Card title="我的积分统计" loading={statsLoading}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                  {userStats.currentScore}
                </div>
                <div style={{ color: '#666' }}>当前积分</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                  #{userStats.rank}
                </div>
                <div style={{ color: '#666' }}>排名</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#faad14' }}>
                  +{userStats.monthlyScore}
                </div>
                <div style={{ color: '#666' }}>本月获得</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#722ed1' }}>
                  {userStats.totalEarned}
                </div>
                <div style={{ color: '#666' }}>累计获得</div>
              </div>
            </div>
          </Card>
        )}

        {/* 排行榜表格 */}
        <Card title="积分排行榜" extra={
          <Button type="primary" onClick={loadRankings} loading={loading}>
            刷新
          </Button>
        }>
          <Table
            columns={columns}
            dataSource={rankings}
            rowKey="userId"
            loading={loading}
            pagination={false}
            size="middle"
          />
        </Card>
      </Space>

      {/* 积分调整模态框 */}
      <Modal
        title={`调整用户 ${selectedUser?.username} 的积分`}
        open={adjustModalVisible}
        onCancel={() => {
          setAdjustModalVisible(false);
          adjustForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={adjustForm}
          layout="vertical"
          onFinish={handleAdjustScore}
        >
          <Form.Item
            name="scoreChange"
            label="积分变化"
            rules={[{ required: true, message: '请输入积分变化值' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="正数表示增加，负数表示减少"
            />
          </Form.Item>

          <Form.Item
            name="reason"
            label="调整原因"
            rules={[{ required: true, message: '请输入调整原因' }]}
          >
            <TextArea
              rows={3}
              placeholder="请说明积分调整的原因"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setAdjustModalVisible(false);
                adjustForm.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                确认调整
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ScoreRanking;
