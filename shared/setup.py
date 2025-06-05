from setuptools import setup, find_packages

setup(
    name="shared",
    version="1.0.0",
    packages=find_packages(),
    description="Shared types for ClauseIQ frontend and backend",
    author="ClauseIQ Team",
    author_email="support@clauseiq.com",
    install_requires=[
        "pydantic>=2.0.0",
    ],
)
