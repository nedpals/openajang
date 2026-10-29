"""Regression tests for the OpenAjang working draft, all local/offline."""
import copy,datetime as dt,importlib.util,json,re,unittest,xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('oa',ROOT/'tools/openajang.py');oa=importlib.util.module_from_spec(spec);spec.loader.exec_module(oa)
FILES=sorted((ROOT/'examples').glob('*.openajang.json'))

def baseline():
 return {'$schema':oa.SCHEMA_URL,'type':'event','id':'urn:uuid:514f2697-c7d6-4fa0-975b-8c682a5dcf87','url':'https://example.org/events/build-night-2026','title':'Community Build Night','status':'scheduled','starts_at':'2026-11-14T18:00:00+08:00','ends_at':'2026-11-14T20:00:00+08:00','organizer':{'name':'Example Community'},'location':{'type':'physical','physical':{'name':'Community Hall'}},'registration':{'required':True,'status':'open','url':'https://docs.google.com/forms/d/e/EXAMPLE/viewform'},'updated_at':'2026-10-29T08:00:00Z'}

class Documents(unittest.TestCase):
 def test_all_eight_examples(self):
  self.assertEqual(len(FILES),8)
  for p in FILES:
   with self.subTest(file=p.name):oa.validate(oa.loads(p.read_text()))
 def test_extension_free_fallbacks(self):
  for p in FILES:
   with self.subTest(file=p.name):
    d=oa.loads(p.read_text());d.pop('extensions',None);oa.validate(d)
    self.assertTrue(d.get('description'))
 def test_unknown_properties_ignored_at_all_levels(self):
  d=baseline();d['future']=None;d['organizer']['future']={'any':None};d['location']['physical']['future']=True;oa.validate(d)
 def test_minimal_fenced_example(self):
  blocks=re.findall(r'```json\n(.*?)\n```',(ROOT/'SPEC.md').read_text(),re.S)
  self.assertGreater(len(blocks),0)
  for block in blocks:oa.validate(oa.loads(block))
 def test_required_fields(self):
  for k in ['$schema','type','url','title','status','starts_at','location','organizer','updated_at']:
   with self.subTest(field=k):
    d=baseline();d.pop(k)
    with self.assertRaises(oa.Invalid):oa.validate(d)
 def test_invalid_scalar_values(self):
  for field,value in [('title',' '),('title',None),('type','Event'),('status','sold_out'),('$schema','https://example.org/schema/other.json'),('url','ftp://example.org/a'),('url','https://user:secret@example.org/a'),('url','https://example.org:99999/a'),('id','relative-id'),('time_zone','Moon/Tranquility'),('language','en--US')]:
   with self.subTest(field=field,value=value):
    d=baseline();d[field]=value
    with self.assertRaises(oa.Invalid):oa.validate(d)
 def test_strict_json(self):
  for source in ['{"title":"a","title":"b"}','{"x":NaN}','{"x":Infinity}']:
   with self.subTest(source=source):
    with self.assertRaises((oa.Invalid,ValueError)):oa.loads(source)
  d=baseline();d['title']='\ud800'
  with self.assertRaises(oa.Invalid):oa.validate(d)
 def test_uri_syntax(self):
  for value in ['https://example.org/<script>','https://example.org/%broken','https://example.org/a#b#c','https://example.org/é']:
   with self.subTest(url=value):
    d=baseline();d['url']=value
    with self.assertRaises(oa.Invalid):oa.validate(d)
  d=baseline();d['url']='https://example.org/%C3%A9';oa.validate(d)
 def test_date_rules(self):
  for bad in ['2026-02-30','2026-11-14T18:00:00','2026-11-14T18:00:60Z','2026-11-14t18:00:00z','2026-11-14T18:00:00-00:00','2026-11-14T18:00:00+08:99']:
   with self.subTest(value=bad):
    d=baseline();d['starts_at']=bad
    with self.assertRaises(oa.Invalid):oa.validate(d)
  for end in ['2026-11-14','2026-11-14T18:00:00+08:00','2026-11-14T17:00:00+08:00']:
   d=baseline();d['ends_at']=end
   with self.assertRaises(oa.Invalid):oa.validate(d)
  d=baseline();d['starts_at']=d['ends_at']='2026-11-14';oa.validate(d)
  d['ends_at']='2026-11-13'
  with self.assertRaises(oa.Invalid):oa.validate(d)
 def test_precision_history(self):
  d=baseline();d['status']='rescheduled';d['previous_starts_at']=['2026-10-17'];oa.validate(d)
  d['previous_starts_at']=['2026-11-14T10:00:00Z']
  with self.assertRaises(oa.Invalid):oa.validate(d)
  d['previous_starts_at']=['2026-10-17','2026-10-17']
  with self.assertRaises(oa.Invalid):oa.validate(d)
  d.pop('previous_starts_at')
  with self.assertRaises(oa.Invalid):oa.validate(d)
 def test_submicrosecond_end_order(self):
  d=baseline();d['starts_at']='2026-11-14T10:00:00.0000001Z';d['ends_at']='2026-11-14T10:00:00.0000002Z';oa.validate(d)
  d['ends_at']='2026-11-14T10:00:00.0000000Z'
  with self.assertRaises(oa.Invalid):oa.validate(d)
 def test_location_rules(self):
  cases=[{'type':'physical','physical':{}},{'type':'physical','physical':{'name':'TBA'}},{'type':'virtual','virtual':{'url':'https://example.org/info'},'physical':{'name':'Hall'}},{'type':'hybrid','physical':{'name':'Hall'}},{'type':'physical','physical':{'name':'Hall','coordinates':{'latitude':91,'longitude':0}}},{'type':'physical','physical':{'name':'Hall','address':{'country':'ZZ'}}}]
  for loc in cases:
   with self.subTest(location=loc):
    d=baseline();d['location']=loc
    with self.assertRaises(oa.Invalid):oa.validate(d)
  d=baseline();d['location']={'type':'physical','physical':{'status':'to_be_announced','address':{'country':'PH'}}};oa.validate(d)
  for t,loc in [('virtual',{'virtual':{'url':'https://example.org/info'}}),('hybrid',{'physical':{'name':'Hall'},'virtual':{'url':'https://example.org/info'}})]:
   d=baseline();d['location']={'type':t,**loc};oa.validate(d)
 def test_tickets_and_tags(self):
  for amount in ['-1','01','1e2','PHP 10','1,000','1.']:
   with self.subTest(amount=amount):
    d=baseline();d['tickets']=[{'id':'general','name':'General','price':{'amount':amount,'currency':'PHP'}}]
    with self.assertRaises(oa.Invalid):oa.validate(d)
  d=baseline();d['tickets']=[{'id':'a','name':'A'},{'id':'a','name':'B'}]
  with self.assertRaises(oa.Invalid):oa.validate(d)
  d=baseline();d['tags']=['Straße','STRASSE']
  with self.assertRaises(oa.Invalid):oa.validate(d)
  d=baseline();d['tickets']=[{'id':'free','name':'Free','price':{'amount':'0','currency':'PHP'}}];oa.validate(d)
  d['tickets'][0]['price']['currency']='ZZZ'
  with self.assertRaises(oa.Invalid):oa.validate(d)
 def test_time_windows(self):
  d=baseline();d['registration'].update(opens_at='2026-10-01T12:00:00Z',closes_at='2026-10-01T11:00:00Z')
  with self.assertRaises(oa.Invalid):oa.validate(d)
  d=baseline();d['tickets']=[{'id':'general','name':'General','sales_start':'2026-10-01T12:00:00Z','sales_end':'2026-10-01T12:00:00Z'}]
  with self.assertRaises(oa.Invalid):oa.validate(d)
 def test_unsupported_schedule_rejected(self):
  d=baseline();d['schedule']={'type':'weekly'}
  with self.assertRaises(oa.Invalid):oa.validate(d)
 def test_extension_names(self):
  d=baseline();d['extensions']={'com.example:optional':None};oa.validate(d)
  for key in ['private','a:b:c',':empty']:
   d['extensions']={key:{}}
   with self.assertRaises(oa.Invalid):oa.validate(d)

class LifecycleAndDiscovery(unittest.TestCase):
 def test_registration_labels(self):
  for state,label in [('open','Register'),('waitlist','Join waitlist'),('unknown','View registration'),(None,'View registration'),('closed',None),('not_yet_open',None)]:
   d=baseline()
   if state:d['registration']['status']=state
   else:d['registration'].pop('status')
   result=oa.registration_action(d);self.assertEqual(result['label'] if result else None,label)
  for status in ['cancelled','postponed','completed']:
   d=baseline();d['status']=status;self.assertIsNone(oa.registration_action(d))
 def test_refresh_matrix(self):
  d=baseline();new=copy.deepcopy(d);new['location']['physical']['name']='New hall'
  for code,result in [(304,'retain'),(404,'rediscover-before-removal'),(410,'document-removed-not-cancelled'),(500,'retain-and-backoff'),(503,'retain-and-backoff'),(0,'retain-and-backoff')]:self.assertEqual(oa.refresh_decision(code,d),result)
  self.assertEqual(oa.refresh_decision(200,d,new),'replace')
  self.assertEqual(oa.refresh_decision(200,d,new,False),'unverified-source-conflict')
  new['id']='urn:uuid:94f699c4-716e-453c-84dd-392a6136ce02';self.assertEqual(oa.refresh_decision(200,d,new),'identity-conflict')
  self.assertEqual(oa.refresh_decision(200,d,{}),'retain-invalid')
 def test_discovery(self):
  link='<link rel="alternate" type="application/vnd.openajang+json" href="event.json">'
  self.assertEqual(oa.discover('<head>'+link+'</head>','https://example.org/events/page'),'https://example.org/events/event.json')
  self.assertEqual(oa.discover('<head>'+link+link+'</head>','https://example.org/events/page'),'https://example.org/events/event.json')
  self.assertIsNone(oa.discover('<body>'+link+'</body>','https://example.org/events/page'))
  self.assertIsNone(oa.discover('<head><link rel="alternate" type="application/json" href="event.json"></head>','https://example.org/'))
  with self.assertRaises(oa.Invalid):oa.discover('<head>'+link+link.replace('event.json','other.json')+'</head>','https://example.org/events/page')
 def test_base_is_ignored_and_cross_origin_allowed(self):
  html='<head><base href="https://wrong.example/"><link rel="ALTERNATE" type="APPLICATION/VND.OPENAJANG+JSON" href="event.json"></head>'
  self.assertEqual(oa.discover(html,'https://example.org/events/page'),'https://example.org/events/event.json')
  self.assertEqual(oa.discover(html.replace('href="event.json"','href="https://cdn.example.org/event.json"'),'https://example.org/'),'https://cdn.example.org/event.json')
 def test_normalization(self):
  self.assertEqual(oa.normalize_url('HTTPS://EXAMPLE.ORG:443/a/../b#part'),'https://example.org/b')
  self.assertEqual(oa.normalize_url('https://example.org/a//b'),'https://example.org/a//b')
  self.assertNotEqual(oa.normalize_url('https://example.org/a'),oa.normalize_url('https://example.org/a/'))
  self.assertNotEqual(oa.normalize_url('https://example.org/?a=1&b=2'),oa.normalize_url('https://example.org/?b=2&a=1'))
 def test_discovery_limits_and_unsafe_urls(self):
  with self.assertRaises(oa.Invalid):oa.discover('x'*1048577,'https://example.org/')
  for target in ['javascript:alert(1)','https://user:password@example.org/e.json']:
   with self.assertRaises(oa.Invalid):oa.discover('<head><link rel="alternate" type="application/vnd.openajang+json" href="'+target+'"></head>','https://example.org/')

class Outputs(unittest.TestCase):
 def test_schema_org_all_examples(self):
  for p in FILES:
   with self.subTest(file=p.name):
    d=oa.loads(p.read_text());out,notes=oa.schema_org(d)
    self.assertEqual(out['@id'],oa.event_id(d));self.assertEqual(out['startDate'],d['starts_at']);self.assertNotIn('dateModified',out);self.assertTrue(notes)
    for src,tgt in zip(d.get('tickets',[]),out.get('offers',[])):
     self.assertEqual('price' in src,'price' in tgt)
 def test_date_only_declined(self):
  for p in FILES:
   d=oa.loads(p.read_text())
   if oa.DATE_RE.fullmatch(d['starts_at']):
    out,notes=oa.jscalendar(d);self.assertIsNone(out);self.assertIn('Declined',notes[0])
 def test_timed_js_preserves_instants(self):
  for p in FILES:
   d=oa.loads(p.read_text())
   if not oa.DATE_RE.fullmatch(d['starts_at']):
    out,notes=oa.jscalendar(d);self.assertEqual(oa.parse_stamp(out['start']+'Z'),oa.parse_stamp(d['starts_at']));self.assertEqual(out['uid'],oa.event_id(d))
    seconds=oa.parse_stamp(d['ends_at'])-oa.parse_stamp(d['starts_at']);self.assertEqual(out['duration'],'PT'+format(seconds,'f')+'S')
 def test_dst_transition_and_fraction(self):
  d=baseline();d['starts_at']='2026-11-01T01:30:00-04:00';d['ends_at']='2026-11-01T02:30:00-05:00'
  out,_=oa.jscalendar(d);self.assertEqual(out['duration'],'PT7200S');self.assertEqual(out['start'],'2026-11-01T05:30:00')
  d['starts_at']='2026-11-14T10:00:00.000001Z';d['ends_at']='2026-11-14T10:00:00.000002Z'
  out,_=oa.jscalendar(d);self.assertEqual(out['duration'],'PT0.000001S')
  d['starts_at']='2026-11-14T10:00:00.0000001Z';out,notes=oa.jscalendar(d);self.assertIsNone(out)
 def test_postponed_declined_and_cancelled_inactive(self):
  d=baseline();d['status']='postponed';self.assertIsNone(oa.jscalendar(d)[0])
  d['status']='cancelled';s,_=oa.schema_org(d);j,_=oa.jscalendar(d)
  self.assertNotIn('potentialAction',s);self.assertNotIn('registration',j['links']);self.assertEqual(j['status'],'cancelled')
 def test_unknown_and_closed_registration(self):
  for state in ['closed','not_yet_open']:
   d=baseline();d['registration']['status']=state;s,_=oa.schema_org(d);j,_=oa.jscalendar(d)
   self.assertNotIn('potentialAction',s);self.assertNotIn('registration',j['links'])
  d=baseline();d['registration']['status']='unknown';self.assertEqual(oa.schema_org(d)[0]['potentialAction']['name'],'View registration')
 def test_endless_event_diagnostic(self):
  d=baseline();d.pop('ends_at');out,notes=oa.jscalendar(d);self.assertIsNone(out);self.assertTrue(any('unknown end' in n for n in notes))
 def test_party_types_not_invented(self):
  d=baseline();d['organizer']={'name':'Example Person','phone':'+63 000 000 0000'}
  out,_=oa.schema_org(d);self.assertNotIn('@type',out['organizer']);self.assertEqual(out['organizer']['telephone'],d['organizer']['phone']);self.assertNotIn('phone',out['organizer'])
 def test_atom_and_rss_links(self):
  ns={'a':'http://www.w3.org/2005/Atom'}
  feed=ET.parse(ROOT/'examples/directory.atom').getroot();entries=feed.findall('a:entry',ns);self.assertEqual(len(entries),8)
  expected={oa.event_id(oa.loads(p.read_text())) for p in FILES}
  self.assertEqual({e.find('a:id',ns).text for e in entries},expected)
  for e in entries:
   links=[x for x in e.findall('a:link',ns) if x.get('type')==oa.MEDIA];self.assertEqual(len(links),1);self.assertTrue(oa.url_ok(links[0].get('href')))
   self.assertIsNotNone(e.find('a:updated',ns));self.assertIsNotNone(e.find('a:summary',ns))
  rss=ET.parse(ROOT/'examples/directory.rss').getroot();items=rss.findall('channel/item');self.assertEqual(len(items),8)
  self.assertEqual({e.find('guid').text for e in items},expected)
 def test_no_default_cheapest_or_fake_free(self):
  d=oa.loads((ROOT/'examples/devcon-8-india-2026.openajang.json').read_text());out,_=oa.schema_org(d)
  self.assertNotIn('lowPrice',json.dumps(out));self.assertEqual(len(out['offers']),6)
  d=oa.loads((ROOT/'examples/chasing-clouds-2026.openajang.json').read_text());out,_=oa.schema_org(d);self.assertNotIn('price',out['offers'][0])
 def test_museum_date_envelope(self):
  museum=oa.loads((ROOT/'examples/chasing-clouds-2026.openajang.json').read_text());self.assertEqual(museum['ends_at'],'2027-02-28');self.assertNotIn('schedule',museum)

if __name__=='__main__':unittest.main(verbosity=2)
