from fastapi.testclient import TestClient


def test_customer_registration_login_and_me_flow(client: TestClient) -> None:
    # 1. Register customer
    reg_res = client.post(
        "/auth/customer/register",
        json={
            "name": "Maria Silva",
            "email": "maria@exemplo.com",
            "password": "senha123segura",
        },
    )
    assert reg_res.status_code == 200
    reg_data = reg_res.json()
    assert reg_data["email"] == "maria@exemplo.com"
    assert reg_data["name"] == "Maria Silva"
    assert reg_data["token_type"] == "bearer"
    assert len(reg_data["access_token"]) > 20

    # 2. Duplicate registration fails
    dup_res = client.post(
        "/auth/customer/register",
        json={
            "name": "Outra Maria",
            "email": "maria@exemplo.com",
            "password": "outrasenha123",
        },
    )
    assert dup_res.status_code == 409
    assert dup_res.json()["detail"] == "E-mail já está em uso."

    # 3. Login with credentials
    login_res = client.post(
        "/auth/customer/login",
        json={
            "email": "maria@exemplo.com",
            "password": "senha123segura",
        },
    )
    assert login_res.status_code == 200
    login_token = login_res.json()["access_token"]

    # 4. Access /auth/customer/me with valid token
    me_res = client.get(
        "/auth/customer/me",
        headers={"Authorization": f"Bearer {login_token}"},
    )
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["name"] == "Maria Silva"
    assert me_data["email"] == "maria@exemplo.com"
    assert len(me_data["id"]) > 10


def test_customer_login_fails_with_wrong_password(client: TestClient) -> None:
    client.post(
        "/auth/customer/register",
        json={
            "name": "Joao Teste",
            "email": "joao@exemplo.com",
            "password": "senhadificil",
        },
    )
    res = client.post(
        "/auth/customer/login",
        json={
            "email": "joao@exemplo.com",
            "password": "senhaincorreta",
        },
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "E-mail ou senha incorretos."


def test_customer_me_requires_valid_bearer_token(client: TestClient) -> None:
    # No header
    res1 = client.get("/auth/customer/me")
    assert res1.status_code == 401
    assert res1.json()["detail"] == "Token de autenticação não fornecido."

    # Wrong scheme
    res2 = client.get("/auth/customer/me", headers={"Authorization": "Token 12345"})
    assert res2.status_code == 401
    assert res2.json()["detail"] == "Formato de autorização inválido. Utilize Bearer <token>."

    # Invalid token
    res3 = client.get("/auth/customer/me", headers={"Authorization": "Bearer invalid.token"})
    assert res3.status_code == 401
    assert res3.json()["detail"] == "Sessão inválida ou expirada."


def test_customer_google_sso_flow(client: TestClient) -> None:
    # 1. First time logging in with Google token: automatically creates account
    res1 = client.post(
        "/auth/customer/google",
        json={"id_token": "google-mock-jwt-token"},
    )
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["email"] == "aluno.google@usp.br"
    assert data1["name"] == "Aluno Google USP"
    assert len(data1["access_token"]) > 20

    # 2. Second login with same verified Google token returns existing user
    res2 = client.post(
        "/auth/customer/google",
        json={"id_token": "google-mock-jwt-token"},
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["email"] == "aluno.google@usp.br"
    assert data2["name"] == "Aluno Google USP"

    # 3. Can access /auth/customer/me with returned access token
    me_res = client.get(
        "/auth/customer/me",
        headers={"Authorization": f"Bearer {data2['access_token']}"},
    )
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "aluno.google@usp.br"


def test_customer_google_sso_invalid_payload(client: TestClient) -> None:
    # Missing id_token
    res = client.post(
        "/auth/customer/google",
        json={"email": "victim@usp.br"},
    )
    assert res.status_code == 422

    # Unverifiable id_token rejected
    res_bad = client.post(
        "/auth/customer/google",
        json={"id_token": "bad-forged-token"},
    )
    assert res_bad.status_code == 422
