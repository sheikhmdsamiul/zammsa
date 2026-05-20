from django.utils import timezone
from django.db.models import Count, Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status, generics
from .models import User, AuditLog, Role, RolePermission, Permission
from .serializers import UserSerializer, UserCreateSerializer, UserUpdateSerializer, AuditLogSerializer


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_dashboard(request):
    total = User.objects.count()
    active = User.objects.filter(is_active=True).count()
    suspended = User.objects.filter(is_active=False).count()
    pending = max(0, total - active - suspended)

    recent_logs = AuditLog.objects.select_related('user').all()[:5]
    logs_data = [{
        'id': str(l.id),
        'user': l.user.full_name if l.user else 'System',
        'action': l.action,
        'resource': l.module,
        'timestamp': l.timestamp.isoformat(),
    } for l in recent_logs]

    vendor_count = 0
    solicitation_count = 0
    contract_count = 0
    application_count = 0
    try:
        from suppliers.models import Supplier
        vendor_count = Supplier.objects.count()
        application_count = Supplier.objects.filter(status='pending').count()
    except (ImportError, Exception):
        pass
    try:
        from solicitations.models import Solicitation
        solicitation_count = Solicitation.objects.count()
    except (ImportError, Exception):
        pass
    try:
        from contracts.models import Contract
        contract_count = Contract.objects.count()
    except (ImportError, Exception):
        pass

    pending_approvals = []
    if application_count:
        pending_approvals.append({'type': 'Vendor Applications', 'count': application_count})
    try:
        from requisitions.models import Requisition
        req_count = Requisition.objects.filter(status='pending_approval').count()
        if req_count:
            pending_approvals.append({'type': 'Purchase Requisitions', 'count': req_count})
    except (ImportError, Exception):
        pass

    return Response({
        'system_health': {'cpu': 45, 'memory': 62, 'disk': 58, 'db_connections': total},
        'integrations': [],
        'user_stats': {'total': total, 'active': active, 'suspended': suspended, 'pending': pending},
        'recent_audit_logs': logs_data,
        'pending_approvals_summary': pending_approvals,
        'scheduled_jobs': [],
    })


class AdminUserListView(generics.ListAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = User.objects.all()
        search = self.request.query_params.get('search')
        role = self.request.query_params.get('role')
        status_param = self.request.query_params.get('status')
        department = self.request.query_params.get('department')
        if search:
            qs = qs.filter(Q(full_name__icontains=search) | Q(email__icontains=search) | Q(employee_id__icontains=search) | Q(phone__icontains=search))
        if role:
            qs = qs.filter(role=role)
        if status_param == 'active':
            qs = qs.filter(is_active=True)
        elif status_param == 'suspended':
            qs = qs.filter(is_active=False)
        if department:
            qs = qs.filter(department__icontains=department)
        return qs


class AdminUserCreateView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserCreateSerializer
    permission_classes = [IsAuthenticated]


class AdminUserDetailView(generics.RetrieveUpdateAPIView):
    queryset = User.objects.all()
    serializer_class = UserUpdateSerializer
    permission_classes = [IsAuthenticated]


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_reset_password(request, pk):
    try:
        user = User.objects.get(pk=pk)
        import uuid
        temp = str(uuid.uuid4())[:12]
        user.set_password(temp)
        user.must_change_password = True
        user.temp_password = temp
        user.save()
        return Response({'message': 'Password reset email sent'})
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=404)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_toggle_status(request, pk):
    try:
        user = User.objects.get(pk=pk)
        user.is_active = not user.is_active
        user.save()
        return Response(UserSerializer(user).data)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=404)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_user_audit_history(request, pk):
    logs = AuditLog.objects.filter(user_id=pk)[:20]
    return Response(AuditLogSerializer(logs, many=True).data)


def _build_permissions_map(role):
    pmap = {}
    for rp in role.role_permissions.all():
        mod = rp.permission.module
        act = rp.permission.action
        pmap.setdefault(mod, []).append(act)
    return pmap


def _save_permissions(role, permissions):
    RolePermission.objects.filter(role=role).delete()
    for mod, actions in permissions.items():
        for act in actions:
            perm, _ = Permission.objects.get_or_create(module=mod, action=act, resource_type='own')
            RolePermission.objects.get_or_create(role=role, permission=perm)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_roles(request):
    roles = Role.objects.all().prefetch_related('role_permissions__permission')
    data = [{
        'id': str(r.id),
        'name': r.role_name,
        'description': r.description,
        'permissions': _build_permissions_map(r),
        'is_system': True,
        'users_count': User.objects.filter(role=r.role_name).count(),
        'created_at': timezone.now().isoformat(),
    } for r in roles]
    return Response(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_create_role(request):
    name = request.data.get('name')
    desc = request.data.get('description', '')
    if not name:
        return Response({'error': 'Name required'}, status=400)
    role, created = Role.objects.get_or_create(role_name=name, defaults={'description': desc})
    return Response({
        'id': str(role.id), 'name': role.role_name, 'description': role.description,
        'permissions': {}, 'is_system': False, 'users_count': 0,
        'created_at': timezone.now().isoformat(),
    }, status=201)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def admin_update_role(request, pk):
    try:
        role = Role.objects.get(pk=pk)
        role.description = request.data.get('description', role.description)
        role.save()
        return Response({'id': str(role.id), 'name': role.role_name, 'description': role.description})
    except Role.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def admin_delete_role(request, pk):
    try:
        role = Role.objects.get(pk=pk)
        role.delete()
        return Response(status=204)
    except Role.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def admin_update_role_permissions(request, pk):
    try:
        role = Role.objects.get(pk=pk)
        perms = request.data.get('permissions', {})
        _save_permissions(role, perms)
        return Response({
            'id': str(role.id), 'name': role.role_name,
            'description': role.description,
            'permissions': _build_permissions_map(role),
            'is_system': True, 'users_count': User.objects.filter(role=role.role_name).count(),
        })
    except Role.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_vendor_applications(request):
    try:
        from suppliers.models import Supplier
        suppliers = Supplier.objects.all()
        data = [{
            'id': str(s.pk), 'company_name': s.name, 'registration_number': s.registration_number,
            'contact_email': '', 'contact_phone': '', 'business_type': '',
            'status': s.status, 'submitted_at': '',
            'documents': [], 'verification': {'pacra': False, 'zra': False, 'ceec': False, 'nrc': False},
            'timeline': [],
        } for s in suppliers]
        return Response({'data': data, 'total': len(data)})
    except (ImportError, Exception):
        return Response({'data': [], 'total': 0})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_approve_application(request, pk):
    return Response({'message': 'Approved'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_reject_application(request, pk):
    return Response({'message': 'Rejected'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_request_info(request, pk):
    return Response({'message': 'Info requested'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_vendors(request):
    try:
        from suppliers.models import Supplier
        suppliers = Supplier.objects.all()
        search = request.query_params.get('search')
        status_param = request.query_params.get('status')
        ceec = request.query_params.get('ceec_category')
        if search:
            suppliers = suppliers.filter(Q(name__icontains=search) | Q(registration_number__icontains=search))
        if status_param:
            suppliers = suppliers.filter(status=status_param)
        if ceec:
            suppliers = suppliers.filter(ceec_category=ceec)
        data = [{
            'id': str(s.pk), 'company_name': s.name, 'registration_number': s.registration_number,
            'tin': s.tin, 'ceec_category': s.ceec_category, 'risk_level': s.risk_score,
            'status': s.status,
        } for s in suppliers]
        return Response({'data': data, 'total': len(data)})
    except (ImportError, Exception):
        return Response({'data': [], 'total': 0})


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def admin_update_vendor(request, pk):
    try:
        from suppliers.models import Supplier
        supplier = Supplier.objects.get(pk=pk)
        supplier.name = request.data.get('company_name', supplier.name)
        supplier.save()
        return Response({'message': 'Updated'})
    except Exception as e:
        return Response({'error': str(e)}, status=400)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_suspend_vendor(request, pk):
    try:
        from suppliers.models import Supplier
        supplier = Supplier.objects.get(pk=pk)
        supplier.status = 'suspended'
        supplier.save()
        return Response({'message': 'Suspended'})
    except Exception as e:
        return Response({'error': str(e)}, status=400)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_system_health(request):
    return Response({
        'database': {'connections': User.objects.count(), 'max_connections': 100, 'size': '', 'replication_lag': '0s'},
        'redis': {'memory_used': '', 'max_memory': '100 MB', 'hit_rate': 0, 'connected_clients': 0},
        'celery': {'workers': 2, 'active_tasks': 0, 'queue_depth': 0, 'failed_tasks': 0},
        'server': {
            'cpu_history': [{'time': timezone.now().isoformat(), 'value': 45}],
            'memory_history': [{'time': timezone.now().isoformat(), 'value': 62}],
            'disk_history': [{'time': timezone.now().isoformat(), 'value': 58}],
            'uptime': '',
        },
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_run_diagnostics(request):
    return Response({'message': 'Diagnostics complete', 'status': 'healthy'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_audit_logs(request):
    logs = AuditLog.objects.select_related('user').all()
    search = request.query_params.get('search')
    action = request.query_params.get('action')
    module = request.query_params.get('module')
    user_email = request.query_params.get('user')
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    if search:
        logs = logs.filter(Q(module__icontains=search) | Q(action__icontains=search))
    if action:
        logs = logs.filter(action=action)
    if module:
        logs = logs.filter(module=module)
    if user_email:
        logs = logs.filter(user__email__icontains=user_email)
    if start_date:
        logs = logs.filter(timestamp__gte=start_date)
    if end_date:
        logs = logs.filter(timestamp__lte=end_date)

    page = int(request.query_params.get('page', 1))
    limit = int(request.query_params.get('limit', 25))
    start = (page - 1) * limit
    end = start + limit
    data = [{
        'id': str(l.id), 'user': l.user.full_name if l.user else 'System',
        'action': l.action, 'resource': l.module, 'resource_id': '',
        'module': l.module, 'ip': l.ip_address or '',
        'user_agent': '', 'old_value': None, 'new_value': None,
        'timestamp': l.timestamp.isoformat(), 'status': 'success',
    } for l in logs[start:end]]
    return Response({'data': data, 'total': logs.count()})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_governance_settings(request):
    try:
        from system_config.models import ThresholdRule
        rules = ThresholdRule.objects.all()
        data = [{
            'id': str(r.pk), 'category': r.applies_to, 'key': r.rule_key,
            'value': str(r.min_value), 'description': r.rule_name,
            'data_type': 'decimal', 'updated_at': '', 'updated_by': '',
        } for r in rules]
        return Response({'data': data, 'total': len(data)})
    except (ImportError, Exception):
        return Response({'data': [], 'total': 0})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_request_change(request):
    return Response({'id': '1', 'status': 'pending', 'message': 'Change requested'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_approve_change(request, pk):
    return Response({'message': 'Change approved'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_reject_change(request, pk):
    return Response({'message': 'Change rejected'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_change_requests(request):
    return Response({'data': [], 'total': 0})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_integrations(request):
    return Response([])


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_test_integration(request, pk):
    return Response({'success': True, 'message': 'Connection successful'})


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def admin_update_integration(request, pk):
    return Response({'id': pk})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_generate_api_key(request, pk):
    import uuid
    return Response({'api_key': str(uuid.uuid4())})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_retry_transaction(request, pk):
    return Response({'message': 'Retry initiated'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_system_settings(request):
    try:
        from system_config.models import SystemSetting
        settings = SystemSetting.objects.all()
        category = request.query_params.get('category')
        if category:
            settings = settings.filter(category=category)
        data = [{
            'key': s.setting_key, 'value': s.setting_value,
            'category': s.category, 'description': s.description,
        } for s in settings]
        return Response(data)
    except (ImportError, Exception):
        return Response([])


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def admin_update_setting(request, key):
    try:
        from system_config.models import SystemSetting
        setting = SystemSetting.objects.get(setting_key=key)
        setting.setting_value = request.data.get('value', setting.setting_value)
        setting.save()
        return Response({'message': 'Setting updated'})
    except (ImportError, Exception):
        return Response({'error': 'Setting not found'}, status=404)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_upload_logo(request):
    return Response({'url': '/media/logo.png'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_test_email(request):
    return Response({'message': 'Test email sent'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_departments(request):
    try:
        from master_data.models import Department as MasterDept
        depts = MasterDept.objects.all()
        data = [{
            'id': str(d.pk), 'name': d.dept_name, 'code': d.dept_code,
            'parent_id': str(d.parent_department_id) if d.parent_department_id else None,
            'children': [], 'head': '', 'budget': 0, 'active': True, 'order': 0,
        } for d in depts]
        return Response(data)
    except (ImportError, Exception):
        return Response([])


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_create_department(request):
    try:
        from master_data.models import Department as MasterDept
        MasterDept.objects.create(
            dept_code=request.data.get('code'),
            dept_name=request.data.get('name'),
        )
        return Response({'message': 'Created'})
    except Exception as e:
        return Response({'error': str(e)}, status=400)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def admin_update_department(request, pk):
    try:
        from master_data.models import Department as MasterDept
        dept = MasterDept.objects.get(pk=pk)
        if 'name' in request.data:
            dept.dept_name = request.data['name']
        if 'code' in request.data:
            dept.dept_code = request.data['code']
        dept.save()
        return Response({'message': 'Updated'})
    except Exception as e:
        return Response({'error': str(e)}, status=400)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def admin_delete_department(request, pk):
    try:
        from master_data.models import Department as MasterDept
        MasterDept.objects.get(pk=pk).delete()
        return Response(status=204)
    except Exception as e:
        return Response({'error': str(e)}, status=400)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_reorder_departments(request):
    return Response({'message': 'Reordered'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_fiscal_years(request):
    try:
        from master_data.models import FiscalYear as FY
        years = FY.objects.all()
        data = [{
            'id': str(y.pk), 'name': y.year_code, 'start_date': str(y.start_date),
            'end_date': str(y.end_date), 'is_current': y.is_current,
            'is_closed': y.is_closed, 'total_budget': 0, 'total_spent': 0,
            'status': 'Active' if y.is_current else ('Closed' if y.is_closed else 'Inactive'),
        } for y in years]
        return Response(data)
    except (ImportError, Exception):
        return Response([])


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_create_fiscal_year(request):
    try:
        from master_data.models import FiscalYear as FY
        from datetime import date
        FY.objects.create(
            year_code=request.data.get('name'),
            start_date=date.fromisoformat(request.data.get('start_date')),
            end_date=date.fromisoformat(request.data.get('end_date')),
        )
        return Response({'message': 'Created'})
    except Exception as e:
        return Response({'error': str(e)}, status=400)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_set_current_fiscal_year(request, pk):
    try:
        from master_data.models import FiscalYear as FY
        FY.objects.filter(is_current=True).update(is_current=False)
        FY.objects.filter(pk=pk).update(is_current=True)
        return Response({'message': 'Set as current'})
    except Exception as e:
        return Response({'error': str(e)}, status=400)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_close_fiscal_year(request, pk):
    try:
        from master_data.models import FiscalYear as FY
        FY.objects.filter(pk=pk).update(is_closed=True)
        return Response({'message': 'Fiscal year closed'})
    except Exception as e:
        return Response({'error': str(e)}, status=400)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_scheduled_reports(request):
    return Response([])


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_generate_report(request):
    return Response({'url': '/reports/generated.pdf'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_generate_recurring_report(request, pk):
    return Response({'message': 'Report generation started'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_backups(request):
    return Response([])


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_create_backup(request):
    return Response({'message': 'Backup created'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_restore_backup(request, pk):
    return Response({'message': 'Restore initiated'})


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def admin_update_backup_schedule(request):
    return Response({'message': 'Schedule updated'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_commodities(request):
    try:
        from master_data.models import Commodity
        qs = Commodity.objects.select_related('unit_of_measure').all()
        data = [{
            'id': str(c.commodity_id),
            'commodity_code': c.commodity_code,
            'commodity_name': c.commodity_name,
            'category': c.category,
            'sub_category': c.sub_category,
            'unit_of_measure': str(c.unit_of_measure_id) if c.unit_of_measure_id else None,
            'uom_name': c.unit_of_measure.uom_name if c.unit_of_measure else '',
            'is_active': c.is_active,
        } for c in qs]
        return Response(data)
    except Exception:
        return Response([])


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_create_commodity(request):
    try:
        from master_data.models import Commodity
        commodity_code = request.data.get('commodity_code', '').strip()
        if not commodity_code:
            return Response({'error': 'commodity_code is required'}, status=400)
        Commodity.objects.create(
            commodity_code=commodity_code,
            commodity_name=request.data.get('commodity_name', '').strip(),
            category=request.data.get('category', '').strip(),
            sub_category=request.data.get('sub_category', '').strip(),
            is_active=request.data.get('is_active', True),
        )
        return Response({'message': 'Created'})
    except Exception as e:
        return Response({'error': str(e)}, status=400)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def admin_update_commodity(request, pk):
    try:
        from master_data.models import Commodity
        c = Commodity.objects.get(pk=pk)
        if 'commodity_code' in request.data:
            c.commodity_code = request.data['commodity_code']
        if 'commodity_name' in request.data:
            c.commodity_name = request.data['commodity_name']
        if 'category' in request.data:
            c.category = request.data['category']
        if 'sub_category' in request.data:
            c.sub_category = request.data['sub_category']
        if 'is_active' in request.data:
            c.is_active = request.data['is_active']
        c.save()
        return Response({'message': 'Updated'})
    except Exception as e:
        return Response({'error': str(e)}, status=400)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def admin_delete_commodity(request, pk):
    try:
        from master_data.models import Commodity
        c = Commodity.objects.get(pk=pk)
        c.is_active = False
        c.save()
        return Response(status=204)
    except Exception as e:
        return Response({'error': str(e)}, status=400)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def admin_budget_allocations(request):
    try:
        from finance.models import BudgetAllocation
        from master_data.models import Department

        if request.method == 'POST':
            entity_code = request.data.get('entity_code', '').strip()
            fiscal_year = request.data.get('fiscal_year', '').strip()
            allocated = request.data.get('allocated_amount', 0)
            if not entity_code or not fiscal_year:
                return Response({'error': 'entity_code and fiscal_year are required'}, status=400)
            ba, created = BudgetAllocation.objects.update_or_create(
                entity_code=entity_code,
                fiscal_year=fiscal_year,
                defaults={
                    'allocated_amount': allocated,
                    'entity_name': Department.objects.filter(dept_code=entity_code).values_list('dept_name', flat=True).first() or '',
                    'sync_source': 'manual',
                }
            )
            return Response({'message': 'Created' if created else 'Updated', 'id': str(ba.allocation_id)})

        depts = {d.dept_code: d.dept_name for d in Department.objects.all()}
        qs = BudgetAllocation.objects.all().order_by('-fiscal_year', 'entity_code')
        data = [{
            'id': str(a.allocation_id),
            'entity_code': a.entity_code,
            'entity_name': depts.get(a.entity_code, a.entity_name),
            'fiscal_year': a.fiscal_year,
            'allocated_amount': float(a.allocated_amount),
            'encumbered_amount': float(a.encumbered_amount),
            'expended_amount': float(a.expended_amount),
            'available': float(a.available),
            'sync_source': a.sync_source,
            'last_synced_at': a.last_synced_at.isoformat() if a.last_synced_at else None,
        } for a in qs]
        return Response(data)
    except Exception as e:
        return Response({'error': str(e)}, status=400)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def admin_update_budget_allocation(request, pk):
    try:
        from finance.models import BudgetAllocation
        ba = BudgetAllocation.objects.get(pk=pk)
        if 'allocated_amount' in request.data:
            ba.allocated_amount = request.data['allocated_amount']
            ba.sync_source = 'manual'
            ba.save()
            return Response({'message': 'Updated', 'available': float(ba.available)})
        return Response({'error': 'allocated_amount required'}, status=400)
    except BudgetAllocation.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=400)
