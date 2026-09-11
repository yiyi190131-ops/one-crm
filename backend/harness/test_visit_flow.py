"""Offline integration regression; isolated DB and no external model calls."""
import os
import tempfile
import unittest
from pathlib import Path

_TEMP = tempfile.TemporaryDirectory()
os.environ['DATABASE_URL'] = 'sqlite:///' + str(Path(_TEMP.name) / 'test.db')
os.environ['AI_PROVIDER'] = 'local'
from fastapi.testclient import TestClient
from sqlalchemy import select, func
from app.main import app
from app.core.database import SessionLocal
from app.models import VisitRecord, FollowUpTask
from app.services.tools import retrieve_approved_evidence, extract_visit_record

class VisitFlowTests(unittest.TestCase):
    def setUp(self):
        self.client_context = TestClient(app)
        self.c = self.client_context.__enter__()
        import uuid
        self.user = uuid.uuid4().hex
        self.conv = self.c.post('/api/conversations', json={'user_id': self.user, 'customer_id': 'liu-min'}).json()['id']

    def tearDown(self):
        self.client_context.__exit__(None, None, None)

    def ask(self, text, mode='post'):
        res = self.c.post('/api/agent', json={'message':text,'mode':mode,'customer_id':'liu-min','user_id':self.user,'conversation_id':self.conv})
        self.assertEqual(res.status_code, 200, res.text)
        return res.json()

    def confirm(self, result, decision='ignore', **edits):
        values = result['extracted']
        a = result['suggested_action']
        return self.c.post('/api/visits/confirm', json={
            'user_id':self.user, 'action':'create-follow-up','draft_id':a['draft_id'],
            'confirmation_token':a['confirmation_token'],'feedback':values['feedback'],
            'next_visit':values['next_visit'],'follow_up':values['follow_up'],
            'todo_decision':decision, **edits})

    def test_multiturn_ignore_readback_and_isolation(self):
        first = self.ask('医生不认可长期安全性，仍然担心风险。')
        second = self.ask('补充一下，下周五上午复访，需要青少年资料。')
        self.assertIn('不认可', second['extracted']['feedback'])
        self.assertIn('下周五',second['extracted']['next_visit'])
        self.assertEqual(second['extracted']['ladder_updates'][0]['to'],'中立')
        self.assertEqual(self.confirm(first).status_code,409)
        result = self.confirm(second).json()
        self.assertIsNone(result['task_id'])
        self.assertEqual(self.confirm(second).json()['visit_id'],result['visit_id'])
        answer = self.ask('最近互动记录和待办是什么？','auto')
        self.assertIn('下周五',answer['reply'])
        self.assertIn('不认可',answer['reply'])
        other=self.c.get(f'/api/conversations/{self.conv}?user_id=someone-else')
        self.assertEqual(other.status_code,404)
        with SessionLocal() as db:
            self.assertEqual(db.scalar(select(func.count()).select_from(VisitRecord).where(VisitRecord.id==result['visit_id'])),1)
            self.assertEqual(db.scalar(select(func.count()).select_from(FollowUpTask).where(FollowUpTask.visit_id==result['visit_id'])),0)

    def test_adoption_edits_and_retry(self):
        result=self.ask('医生认可长期安全，下周四下午复访，准备青少年资料。')
        action=result['suggested_action']
        req={'decision':'adopt','date':'下周四下午','material':'青少年资料',
            'user_id':self.user,'draft_id':action['draft_id'],'confirmation_token':action['confirmation_token']}
        self.assertEqual(self.c.post('/api/tasks/decision',json=req).status_code,200)
        with SessionLocal() as db:
            self.assertIsNone(db.scalar(select(FollowUpTask).where(FollowUpTask.id=='TSK-'+action['draft_id'].replace('-','')[:24])))
        receipt=self.confirm(result,'adopt',next_visit='2026-10-01 下午',feedback='用户核对后的完整反馈').json()
        self.assertTrue(receipt['task_id'])
        self.assertEqual(self.confirm(result,'adopt').json(),receipt)
        answer=self.ask('最近互动和待办？','auto')['reply']
        self.assertIn('用户核对后的完整反馈',answer)
        self.assertIn('2026-10-01',answer)

    def test_new_visit_boundary(self):
        self.ask('医生认可长期安全，下周四下午复访。')
        self.c.post(f'/api/conversations/{self.conv}/events',json={'user_id':self.user,'seconds':10,'shown_aids':[]})
        fresh=self.ask('这次主要讨论疾病维稳。')
        self.assertNotIn('下周四',fresh['extracted']['feedback'])
        self.assertEqual(fresh['extracted']['next_visit'],'待确认')

    def test_search_changes_and_empty(self):
        safety=retrieve_approved_evidence('长期安全性')
        youth=retrieve_approved_evidence('青少年生长发育')
        self.assertNotEqual(safety['citation']['id'],youth['citation']['id'])
        self.assertEqual(retrieve_approved_evidence('量子力学')['hit_count'],0)
        self.assertTrue(all(d['id'] not in ('demo-expired','demo-unapproved') for d in safety['documents']))
        answer=self.ask('查询量子力学','auto')
        self.assertEqual(answer['route'],'capability_guide')

    def test_negation_and_no_invented_change(self):
        value=extract_visit_record('医生不认可长期安全，仍担心风险。')
        self.assertEqual(value['ladder_updates'][0]['to'],'中立')
        self.assertEqual(extract_visit_record('医生今天很忙。')['ladder_updates'],[])

    def test_no_fallback_token_and_wrong_owner(self):
        r=self.ask('医生反馈不错。')
        self.assertEqual(self.confirm(r,user_id='other').status_code,404)
        self.assertEqual(self.confirm(r,draft_id=None,confirmation_token='demo-confirmation-token').status_code,400)

    def test_stream_and_customer_readback(self):
        r=self.ask('下周四下午复访。')
        self.confirm(r,feedback='最新保存的医生反馈')
        customers=self.c.get('/api/customers',params={'user_id':self.user}).json()
        self.assertEqual(next(x for x in customers if x['id']=='liu-min')['last_feedback'],'最新保存的医生反馈')
        other=self.c.get('/api/customers',params={'user_id':'new-visitor'}).json()
        self.assertNotEqual(next(x for x in other if x['id']=='liu-min')['last_feedback'],'最新保存的医生反馈')
        stream=self.c.post('/api/agent/stream',json={'message':'最近互动记录','user_id':self.user,'customer_id':'liu-min','conversation_id':self.conv})
        self.assertEqual(stream.status_code,200)
        self.assertIn('event: final',stream.text)

if __name__=='__main__': unittest.main(verbosity=2)
